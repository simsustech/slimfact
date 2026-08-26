import { createHash, randomBytes } from "node:crypto";

/** `obk_<env>_` + 32 random bytes as unpadded base64url (43 chars). */
export const API_KEY_REGEX = /^obk_(live|test)_[A-Za-z0-9_-]{43}$/;
export const API_KEY_PREFIX_LENGTH = 12;

export const generateKey = (env: "live" | "test" = "test"): string =>
  `obk_${env}_${randomBytes(32).toString("base64url")}`;

export const hashKey = (key: string): string => createHash("sha256").update(key).digest("hex");

/** First characters of the raw key — safe to display/store for lookup. */
export const keyPrefix = (key: string): string => key.slice(0, API_KEY_PREFIX_LENGTH);

export const isValidKeyFormat = (key: string): boolean => API_KEY_REGEX.test(key);

export interface KeyValidity {
  revokedAt: Date | null;
  expiresAt: Date | null;
}

export const isValidKey = ({ revokedAt, expiresAt }: KeyValidity): boolean => {
  const now = Date.now();
  if (revokedAt && revokedAt.getTime() <= now) return false;
  if (expiresAt && expiresAt.getTime() <= now) return false;
  return true;
};
