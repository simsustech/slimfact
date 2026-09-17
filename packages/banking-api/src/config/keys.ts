import { readFileSync } from "node:fs";
import type { Kysely } from "kysely";
import { z } from "zod";
import { hashKey, isValidKeyFormat, keyPrefix } from "../api-keys/keys.js";
import type { DB } from "../kysely/types.js";

export const apiKeyConfigSchema = z.object({
  apiKeys: z.array(
    z.object({
      label: z.string().min(1),
      key: z.string().refine(isValidKeyFormat, {
        message: "key must match obk_(live|test)_<43 base64url chars>",
      }),
      scopes: z.array(z.enum(["read", "sync"])).default(["read"]),
      /** ISO date; the key stops working after this moment. */
      expiresAt: z.string().optional(),
      /** External account ids this key may read (and sync, with the `sync` scope). */
      accounts: z.array(z.string()).default([]),
    }),
  ),
});

export type ApiKeyConfig = z.infer<typeof apiKeyConfigSchema>;

/**
 * Reads and validates the mounted config file. Throws on any problem so the
 * caller can fail closed (exit 1) instead of running with partial keys.
 */
export const loadKeyConfig = (path: string): ApiKeyConfig => {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (error) {
    throw new Error(`Cannot read key config file at ${path}: ${(error as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Key config file at ${path} is not valid JSON: ${(error as Error).message}`);
  }
  const parsed = apiKeyConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Key config file at ${path} is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
};

/** One `apiKeys` entry, with schema defaults applied. */
export type ApiKeyEntry = ApiKeyConfig["apiKeys"][number];

export interface KeyEntryInput {
  label: string;
  key: string;
  scopes?: ApiKeyEntry["scopes"];
  accounts?: string[];
  expiresAt?: string;
}

/**
 * Builds one `apiKeys` entry for tooling (`add-key`). The key format and the
 * expiry are checked here so a typo fails at the CLI rather than at the next
 * boot — or worse, never: the schema only requires `expiresAt` to be a string,
 * and `new Date("tomorrow")` would pass it and then never expire the key.
 */
export const buildKeyEntry = ({
  label,
  key,
  scopes = ["read"],
  accounts = [],
  expiresAt,
}: KeyEntryInput): ApiKeyEntry => {
  if (!isValidKeyFormat(key)) {
    throw new Error(`key must match obk_(live|test)_<43 base64url chars>: "${key}"`);
  }
  if (expiresAt !== undefined && Number.isNaN(new Date(expiresAt).getTime())) {
    throw new Error(`expiresAt is not a parseable date: "${expiresAt}"`);
  }
  // An absent expiry stays absent in the file: JSON.stringify drops `undefined`.
  return apiKeyConfigSchema.parse({ apiKeys: [{ label, key, scopes, accounts, expiresAt }] })
    .apiKeys[0]!;
};

/**
 * Adds an entry to a loaded config. A label names a consumer, so a duplicate is
 * an error unless `replace` is set — replacing rotates that consumer's key,
 * because the old key leaves the file and is revoked at the next boot.
 */
export const upsertKeyEntry = (
  config: ApiKeyConfig,
  entry: ApiKeyEntry,
  { replace = false }: { replace?: boolean } = {},
): ApiKeyConfig => {
  const index = config.apiKeys.findIndex((existing) => existing.label === entry.label);
  if (index === -1) {
    return apiKeyConfigSchema.parse({ apiKeys: [...config.apiKeys, entry] });
  }
  if (!replace) {
    throw new Error(
      `label "${entry.label}" is already in the config — pass --force to replace it and rotate that key`,
    );
  }
  const apiKeys = [...config.apiKeys];
  apiKeys[index] = entry;
  return apiKeyConfigSchema.parse({ apiKeys });
};

/** How a grant was expressed on the command line. */
export interface AccountSelector {
  kind: "iban" | "externalId";
  value: string;
}

export interface SelectedAccounts {
  /** Resolved rows in selector order, deduplicated by external id. */
  accounts: { externalId: string; aspspName: string; iban: string | null }[];
  unknownIbans: string[];
  /** IBANs held by more than one account — IBANs are not unique across ASPSPs. */
  ambiguousIbans: { iban: string; externalIds: string[] }[];
  unknownExternalIds: string[];
}

/**
 * Resolves grant selectors against the accounts already synced into the proxy.
 * An ambiguous IBAN is reported rather than guessed at: silently granting the
 * wrong client's account is the failure this exists to prevent.
 */
export const resolveAccountSelectors = async (
  db: Kysely<DB>,
  selectors: AccountSelector[],
): Promise<SelectedAccounts> => {
  const stored = await db
    .selectFrom("accounts")
    .select(["externalId", "aspspName", "iban"])
    .execute();

  const result: SelectedAccounts = {
    accounts: [],
    unknownIbans: [],
    ambiguousIbans: [],
    unknownExternalIds: [],
  };
  const granted = new Set<string>();

  const grant = (account: (typeof stored)[number]): void => {
    if (granted.has(account.externalId)) return;
    granted.add(account.externalId);
    result.accounts.push(account);
  };

  for (const selector of selectors) {
    if (selector.kind === "externalId") {
      const account = stored.find((candidate) => candidate.externalId === selector.value);
      if (account) grant(account);
      else result.unknownExternalIds.push(selector.value);
      continue;
    }
    const matches = stored.filter((candidate) => candidate.iban === selector.value);
    if (matches.length === 0) result.unknownIbans.push(selector.value);
    else if (matches.length > 1) {
      result.ambiguousIbans.push({
        iban: selector.value,
        // Sorted: `accounts` has no natural order, and this list ends up in a
        // CLI error message, so it must not shuffle between runs.
        externalIds: matches.map((match) => match.externalId).sort(),
      });
    } else grant(matches[0]!);
  }

  return result;
};

export interface ReconcileResult {
  created: number;
  updated: number;
  reactivated: number;
  revoked: number;
  /** Config account ids that do not resolve to a stored account (dormant). */
  unknownAccounts: string[];
}

/**
 * Reconciles the key config file into the DB (single transaction):
 * - upsert keys by hash (DB stores only SHA-256 hashes; clears revoked_at),
 * - grants are replaced wholesale, resolved by external account id,
 * - unknown account ids are warned about and skipped (dormant),
 * - keys not in the config are revoked (revoked_at = now).
 */
export const reconcileKeys = async (
  db: Kysely<DB>,
  config: ApiKeyConfig,
): Promise<ReconcileResult> => {
  const result: ReconcileResult = {
    created: 0,
    updated: 0,
    reactivated: 0,
    revoked: 0,
    unknownAccounts: [],
  };

  const configHashes = config.apiKeys.map((entry) => hashKey(entry.key));
  const allExternalIds = [...new Set(config.apiKeys.flatMap((entry) => entry.accounts))];

  await db.transaction().execute(async (trx) => {
    const accounts = allExternalIds.length
      ? await trx
          .selectFrom("accounts")
          .select(["id", "externalId"])
          .where("externalId", "in", allExternalIds)
          .execute()
      : [];
    const externalToInternal = new Map(accounts.map((account) => [account.externalId, account.id]));
    // Config account ids that do not resolve to a stored account are dormant:
    // warned about once (below), skipped for grants.
    result.unknownAccounts = allExternalIds.filter(
      (externalId) => !externalToInternal.has(externalId),
    );

    for (const entry of config.apiKeys) {
      const keyHash = hashKey(entry.key);
      const existing = await trx
        .selectFrom("api_keys")
        .selectAll()
        .where("keyHash", "=", keyHash)
        .executeTakeFirst();

      const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
      const grantAccountIds = entry.accounts
        .map((externalId) => externalToInternal.get(externalId))
        .filter((accountId): accountId is number => accountId !== undefined);

      if (existing) {
        const wasRevoked = !!existing.revokedAt;
        await trx
          .updateTable("api_keys")
          .set({
            label: entry.label,
            keyPrefix: keyPrefix(entry.key),
            scopes: entry.scopes,
            expiresAt,
            revokedAt: null,
          })
          .where("id", "=", existing.id)
          .execute();
        if (wasRevoked) result.reactivated++;
        else result.updated++;
      } else {
        await trx
          .insertInto("api_keys")
          .values({
            label: entry.label,
            keyHash,
            keyPrefix: keyPrefix(entry.key),
            scopes: entry.scopes,
            expiresAt,
          })
          .execute();
        result.created++;
      }

      const keyId = existing
        ? existing.id
        : (
            await trx
              .selectFrom("api_keys")
              .select("id")
              .where("keyHash", "=", keyHash)
              .executeTakeFirstOrThrow()
          ).id;

      await trx.deleteFrom("api_key_accounts").where("apiKeyId", "=", keyId).execute();
      if (grantAccountIds.length > 0) {
        await trx
          .insertInto("api_key_accounts")
          .values(grantAccountIds.map((accountId) => ({ apiKeyId: keyId, accountId })))
          .execute();
      }
    }

    const storedKeys = await trx
      .selectFrom("api_keys")
      .select(["id", "keyHash", "revokedAt"])
      .execute();
    for (const storedKey of storedKeys) {
      if (!configHashes.includes(storedKey.keyHash) && !storedKey.revokedAt) {
        await trx
          .updateTable("api_keys")
          .set({ revokedAt: new Date() })
          .where("id", "=", storedKey.id)
          .execute();
        result.revoked++;
      }
    }
  });

  if (result.unknownAccounts.length > 0) {
    console.warn(
      `[banking-api] unknown accounts in key config: ${result.unknownAccounts.join(", ")}`,
    );
  }

  return result;
};
