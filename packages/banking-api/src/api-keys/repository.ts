import type { Kysely } from "kysely";
import type { DB } from "../kysely/types.js";
import { hashKey } from "./keys.js";

export interface ApiKeyIdentity {
  id: number;
  label: string;
  keyPrefix: string;
  scopes: string[];
  /** Internal account ids the key is granted (from `api_key_accounts`). */
  accountIds: number[];
  expiresAt: Date | null;
  revokedAt: Date | null;
}

/**
 * Looks up a raw key by SHA-256 hash and returns its identity + grants.
 * Returns null for unknown keys. Callers decide on revoked/expired handling.
 */
export const findKeyByHash = async (
  db: Kysely<DB>,
  rawKey: string,
): Promise<ApiKeyIdentity | null> => {
  const apiKey = await db
    .selectFrom("api_keys")
    .select(["id", "label", "keyPrefix", "scopes", "expiresAt", "revokedAt"])
    .where("keyHash", "=", hashKey(rawKey))
    .executeTakeFirst();
  if (!apiKey) return null;

  const grants = await db
    .selectFrom("api_key_accounts")
    .select("accountId")
    .where("apiKeyId", "=", apiKey.id)
    .execute();

  return {
    ...apiKey,
    accountIds: grants.map((grant) => grant.accountId),
  };
};
