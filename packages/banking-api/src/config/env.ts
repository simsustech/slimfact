import { read, required } from "./index.js";
import { z } from "zod";

/**
 * Integer env var with a fallback. Empty/whitespace values fall back; garbage
 * (non-numeric, fractional) throws at startup instead of silently becoming NaN.
 */
const intEnv = (key: string, fallback: number): number => {
  const raw = read(key)?.trim();
  if (!raw) return fallback;
  const parsed = z.coerce.number().int().safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Environment variable ${key} must be an integer, got: "${raw}"`);
  }
  return parsed.data;
};

export const appConfig = {
  apiHost: required("API_HOST"),

  openbankingCredentialsJson: read("OPENBANKING_CREDENTIALS_JSON"),
  openbankingApiBaseUrl: read("OPENBANKING_API_BASE_URL"),
  openbankingSyncCron: read("OPENBANKING_SYNC_CRON") || "0 */4 7-23 * * *",
  openbankingSyncCooldownSeconds: intEnv("OPENBANKING_SYNC_COOLDOWN_SECONDS", 60),
  openbankingMinSyncIntervalSeconds: intEnv("OPENBANKING_MIN_SYNC_INTERVAL_SECONDS", 60),

  // PSP payout ingestion (Mollie settlements / Stripe payouts). The keys are
  // secrets — never log or dump them.
  mollieApiKey: read("MOLLIE_API_KEY"),
  stripeApiKey: read("STRIPE_API_KEY"),
  pspSyncCron: read("PSP_SYNC_CRON") || "0 30 7-23 * * *",
  pspSyncCooldownSeconds: intEnv("PSP_SYNC_COOLDOWN_SECONDS", 60),

  bankingApiConfigPath: read("BANKING_API_CONFIG_PATH") || "/etc/banking-api/config.json",

  rateLimitPerMinute: intEnv("RATE_LIMIT_PER_MINUTE", 600),
  debug: read("DEBUG"),
} as const;

export type AppConfig = typeof appConfig;

/**
 * True when open-banking.io credentials are configured. The sync queue and the
 * SDK-backed sync are inert (no cron, tame sync results) until this is set.
 */
export const bankingEnabled = (): boolean => !!appConfig.openbankingCredentialsJson;
