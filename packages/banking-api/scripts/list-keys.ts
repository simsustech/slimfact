import { isValidKey } from "../src/api-keys/keys.js";
import { db } from "../src/kysely/index.js";

/**
 * Prints every API key in the database with the accounts it may read, in the
 * same `externalId | aspspName | iban` shape as `list-accounts` — so the
 * per-client split can be checked without SQL.
 *
 *   list-keys [--all]
 *
 * The database is the truth here: it shows what boot reconciliation actually
 * applied, including keys that were revoked by dropping them from the config.
 */
const listKeys = async (): Promise<void> => {
  /** Active = not revoked and not past its expiry; the DB keeps both kinds around. */
  const statusOf = (key: {
    expiresAt: Date | null;
    revokedAt: Date | null;
  }): "active" | "revoked" | "expired" => {
    if (isValidKey(key)) return "active";
    return key.revokedAt ? "revoked" : "expired";
  };
  const includeInactive = process.argv.includes("--all");

  const keys = await db
    .selectFrom("api_keys")
    .select(["id", "label", "keyPrefix", "scopes", "expiresAt", "revokedAt"])
    .orderBy("label")
    .orderBy("id")
    .execute();

  const grants = await db
    .selectFrom("api_key_accounts")
    .innerJoin("accounts", "accounts.id", "api_key_accounts.accountId")
    .select(["apiKeyId", "externalId", "aspspName", "iban"])
    .orderBy("externalId")
    .execute();

  const accountsByKey = new Map<number, typeof grants>();
  for (const grant of grants) {
    const list = accountsByKey.get(grant.apiKeyId) ?? [];
    list.push(grant);
    accountsByKey.set(grant.apiKeyId, list);
  }

  const tally = { active: 0, revoked: 0, expired: 0 };
  const lines: string[] = [];
  for (const key of keys) {
    const status = statusOf(key);
    tally[status]++;

    if (status !== "active" && !includeInactive) continue;

    const expiry = key.expiresAt ? ` (until ${key.expiresAt.toISOString()})` : "";
    lines.push(`${key.label} | ${key.keyPrefix}… | ${key.scopes.join(",")} | ${status}${expiry}`);

    const granted = accountsByKey.get(key.id) ?? [];
    if (granted.length === 0) {
      lines.push("    (no accounts — this key reads nothing)");
      continue;
    }
    for (const account of granted) {
      lines.push(`    ${account.externalId} | ${account.aspspName} | ${account.iban ?? ""}`);
    }
  }

  console.log(
    `${keys.length} keys: ${tally.active} active, ${tally.revoked} revoked, ${tally.expired} expired`,
  );
  if (!includeInactive && tally.revoked + tally.expired > 0) {
    console.log("(pass --all to include revoked and expired keys)");
  }
  console.log("");
  console.log(lines.length > 0 ? lines.join("\n") : "(no keys to show)");
};

listKeys()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.destroy());
