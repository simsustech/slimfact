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
