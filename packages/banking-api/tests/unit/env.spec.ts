import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Pure config tests: no DB. env.ts evaluates appConfig at import time, so each
 * case mutates process.env, resets the module registry, and re-imports.
 */

const ENV_KEYS = [
  "API_HOST",
  "RATE_LIMIT_PER_MINUTE",
  "OPENBANKING_SYNC_COOLDOWN_SECONDS",
  "OPENBANKING_MIN_SYNC_INTERVAL_SECONDS",
  "PSP_SYNC_COOLDOWN_SECONDS",
  "POSTGRES_SSL_INSECURE",
] as const;

const savedEnv = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

const setRequiredEnv = () => {
  process.env.API_HOST = "banking.test";
};

const importEnv = async () => {
  vi.resetModules();
  setRequiredEnv();
  return await import("../../src/config/env.js");
};

describe("config/env numeric validation", () => {
  it("defaults RATE_LIMIT_PER_MINUTE to 600", async () => {
    delete process.env.RATE_LIMIT_PER_MINUTE;
    const { appConfig } = await importEnv();
    expect(appConfig.rateLimitPerMinute).toBe(600);
  });

  it.each(["not-a-number", "12.5", "NaN", "1000000x"])(
    "rejects garbage RATE_LIMIT_PER_MINUTE=%s at startup",
    async (garbage) => {
      process.env.RATE_LIMIT_PER_MINUTE = garbage;
      setRequiredEnv();
      await expect(import("../../src/config/env.js")).rejects.toThrowError(/RATE_LIMIT_PER_MINUTE/);
    },
  );

  it("treats an empty numeric var as unset (fallback applies)", async () => {
    process.env.OPENBANKING_SYNC_COOLDOWN_SECONDS = "";
    const { appConfig } = await importEnv();
    expect(appConfig.openbankingSyncCooldownSeconds).toBe(60);
  });

  it("parses valid integer cooldowns", async () => {
    process.env.OPENBANKING_SYNC_COOLDOWN_SECONDS = "120";
    process.env.PSP_SYNC_COOLDOWN_SECONDS = "45";
    const { appConfig } = await importEnv();
    expect(appConfig.openbankingSyncCooldownSeconds).toBe(120);
    expect(appConfig.pspSyncCooldownSeconds).toBe(45);
  });

  it("rejects fractional OPENBANKING_MIN_SYNC_INTERVAL_SECONDS", async () => {
    process.env.OPENBANKING_MIN_SYNC_INTERVAL_SECONDS = "1.5";
    setRequiredEnv();
    await expect(import("../../src/config/env.js")).rejects.toThrowError(
      /OPENBANKING_MIN_SYNC_INTERVAL_SECONDS/,
    );
  });
});

describe("config/postgres POSTGRES_SSL_INSECURE", () => {
  const setPostgresEnv = () => {
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "unused-in-this-spec";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "slimfact_unit";
    setRequiredEnv();
  };

  const importPostgres = async () => {
    vi.resetModules();
    setPostgresEnv();
    return await import("../../src/config/postgres.js");
  };

  it("is false by default", async () => {
    delete process.env.POSTGRES_SSL_INSECURE;
    const { postgresConfig } = await importPostgres();
    expect(postgresConfig.sslInsecure).toBe(false);
  });

  it("is true only on explicit 'true'", async () => {
    process.env.POSTGRES_SSL_INSECURE = "true";
    const { postgresConfig } = await importPostgres();
    expect(postgresConfig.sslInsecure).toBe(true);
  });

  it("stays false on other values", async () => {
    process.env.POSTGRES_SSL_INSECURE = "false";
    const { postgresConfig } = await importPostgres();
    expect(postgresConfig.sslInsecure).toBe(false);
  });
});
