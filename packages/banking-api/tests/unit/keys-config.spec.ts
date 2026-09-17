import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Kysely } from "kysely";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { generateKey, hashKey, isValidKey } from "../../src/api-keys/keys.js";
import { findKeyByHash } from "../../src/api-keys/repository.js";
import type {
  AccountSelector,
  ApiKeyConfig,
  ReconcileResult,
  SelectedAccounts,
} from "../../src/config/keys.js";
import { apiKeyConfigSchema } from "../../src/config/keys.js";
import type { DB } from "../../src/kysely/types.js";

const dbAvailable = !!process.env.POSTGRES_PASSWORD;

const setRequiredEnv = () => {
  process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
  process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5433";
  process.env.POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
  process.env.POSTGRES_DB = process.env.POSTGRES_DB || "slimfact_unit";
};

// kysely/index.ts redefines BigInt.prototype.toJSON at module load; swallow the
// single redefinition across dynamic imports (same guard as packages/api).
let originalDefineProperty: typeof Object.defineProperty;
let definePropertySpy: MockInstance;

describe.skipIf(!dbAvailable)("key config reconcile", () => {
  const envBackup = { ...process.env };
  let db: Kysely<DB>;
  let reconcileKeys: (db: Kysely<DB>, config: ApiKeyConfig) => Promise<ReconcileResult>;
  let loadKeyConfig: (path: string) => ApiKeyConfig;
  let resolveAccountSelectors: (
    db: Kysely<DB>,
    selectors: AccountSelector[],
  ) => Promise<SelectedAccounts>;

  // zod defaults (scopes: ['read'], accounts: []) apply at parse time, so tests
  // build configs through the schema like loadKeyConfig does.
  const parseConfig = (entries: unknown[]): ApiKeyConfig =>
    apiKeyConfigSchema.parse({ apiKeys: entries });

  beforeAll(async () => {
    setRequiredEnv();
    originalDefineProperty = Object.defineProperty;
    definePropertySpy = vi
      .spyOn(Object, "defineProperty")
      .mockImplementation(
        (
          target: unknown,
          prop: PropertyKey,
          descriptor?: PropertyDescriptor & ThisType<unknown>,
        ): unknown => {
          if (target === BigInt.prototype && prop === "toJSON") {
            return target;
          }
          return originalDefineProperty.call(
            Object,
            target as object,
            prop as PropertyKey,
            descriptor as PropertyDescriptor,
          );
        },
      );

    const kysely = await import("../../src/kysely/index.js");
    db = kysely.db as Kysely<DB>;
    const keys = await import("../../src/config/keys.js");
    reconcileKeys = keys.reconcileKeys;
    loadKeyConfig = keys.loadKeyConfig;
    resolveAccountSelectors = keys.resolveAccountSelectors;
  });

  afterAll(async () => {
    await db?.destroy();
    definePropertySpy?.mockRestore();
    Object.defineProperty = originalDefineProperty;
    process.env = { ...envBackup };
  });

  beforeEach(async () => {
    await db.deleteFrom("api_keys").execute();
    await db.deleteFrom("accounts").execute();
    await db
      .insertInto("accounts")
      .values([
        {
          externalId: "acc-1",
          aspspName: "Knab",
          aspspCountry: "NL",
          currency: "EUR",
          iban: "NL20KNAB0123456780",
        },
        {
          externalId: "acc-2",
          aspspName: "Rabobank",
          aspspCountry: "NL",
          currency: "EUR",
          iban: "NL78RABO9876543210",
        },
      ])
      .execute();
  });

  it("stores only a 64-hex SHA-256 hash, never the raw key", async () => {
    const key = generateKey("test");
    await reconcileKeys(
      db,
      parseConfig([{ label: "e2e", key, scopes: ["read"], accounts: ["acc-1"] }]),
    );

    const rows = await db.selectFrom("api_keys").selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.keyHash).toBe(hashKey(key));
    expect(rows[0]!.scopes).toEqual(["read"]);
    expect(JSON.stringify(rows)).not.toContain(key);
  });

  it("resolves grants by external account id", async () => {
    const key = generateKey();
    await reconcileKeys(db, parseConfig([{ label: "k", key, accounts: ["acc-1", "acc-2"] }]));

    const identity = await findKeyByHash(db, key);
    expect(identity).not.toBeNull();
    expect(identity!.accountIds).toHaveLength(2);
  });

  it("revokes keys missing from the config", async () => {
    const key1 = generateKey();
    const key2 = generateKey();
    await reconcileKeys(db, parseConfig([{ label: "a", key: key1 }]));

    const result = await reconcileKeys(db, parseConfig([{ label: "b", key: key2 }]));
    expect(result.revoked).toBe(1);

    const row = await db
      .selectFrom("api_keys")
      .selectAll()
      .where("keyHash", "=", hashKey(key1))
      .executeTakeFirstOrThrow();
    expect(row.revokedAt).not.toBeNull();
    expect(isValidKey(row)).toBe(false);
  });

  it("reactivates a re-added key", async () => {
    const key1 = generateKey();
    const key2 = generateKey();
    await reconcileKeys(db, parseConfig([{ label: "a", key: key1 }]));
    await reconcileKeys(db, parseConfig([{ label: "b", key: key2 }]));

    const result = await reconcileKeys(db, parseConfig([{ label: "a2", key: key1 }]));
    expect(result.reactivated).toBe(1);

    const row = await db
      .selectFrom("api_keys")
      .selectAll()
      .where("keyHash", "=", hashKey(key1))
      .executeTakeFirstOrThrow();
    expect(row.revokedAt).toBeNull();
    expect(row.label).toBe("a2");
  });

  it("skips unknown accounts with a warning (dormant grant)", async () => {
    const key = generateKey();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await reconcileKeys(
      db,
      parseConfig([{ label: "k", key, accounts: ["acc-1", "missing-account"] }]),
    );
    expect(result.unknownAccounts).toEqual(["missing-account"]);
    expect(warnSpy).toHaveBeenCalled();

    const identity = await findKeyByHash(db, key);
    expect(identity!.accountIds).toHaveLength(1);
    warnSpy.mockRestore();
  });

  it("loadKeyConfig throws a clear error on malformed config", () => {
    const dir = mkdtempSync(join(tmpdir(), "banking-api-keys-"));
    const badFormat = join(dir, "bad-format.json");
    writeFileSync(badFormat, '{"apiKeys": [{"label": "x", "key": "not-a-key"}]}');
    expect(() => loadKeyConfig(badFormat)).toThrow(/key must match|invalid/i);

    const badJson = join(dir, "bad-json.json");
    writeFileSync(badJson, "not json at all");
    expect(() => loadKeyConfig(badJson)).toThrow(/not valid JSON/);

    expect(() => loadKeyConfig(join(dir, "missing.json"))).toThrow(/Cannot read/);
  });

  // Grant selectors are how `add-key` turns the IBANs a client names into the
  // external ids the config stores.
  describe("resolveAccountSelectors", () => {
    it("resolves IBANs and external ids, deduplicating and keeping selector order", async () => {
      const selection = await resolveAccountSelectors(db, [
        { kind: "iban", value: "NL78RABO9876543210" },
        { kind: "externalId", value: "acc-1" },
        { kind: "iban", value: "NL20KNAB0123456780" },
      ]);

      expect(selection.accounts.map((account) => account.externalId)).toEqual(["acc-2", "acc-1"]);
      expect(selection.accounts[1]!.iban).toBe("NL20KNAB0123456780");
      expect(selection.unknownIbans).toEqual([]);
      expect(selection.ambiguousIbans).toEqual([]);
      expect(selection.unknownExternalIds).toEqual([]);
    });

    it("reports unknown selectors instead of granting something else", async () => {
      const selection = await resolveAccountSelectors(db, [
        { kind: "iban", value: "NL00TEST0000000000" },
        { kind: "externalId", value: "not-synced-yet" },
      ]);

      expect(selection.accounts).toEqual([]);
      expect(selection.unknownIbans).toEqual(["NL00TEST0000000000"]);
      expect(selection.unknownExternalIds).toEqual(["not-synced-yet"]);
    });

    it("reports an IBAN held by several accounts rather than guessing one", async () => {
      await db
        .insertInto("accounts")
        .values({
          externalId: "acc-3",
          aspspName: "Bunq",
          aspspCountry: "NL",
          currency: "EUR",
          iban: "NL20KNAB0123456780",
        })
        .execute();

      const selection = await resolveAccountSelectors(db, [
        { kind: "iban", value: "NL20KNAB0123456780" },
      ]);

      expect(selection.accounts).toEqual([]);
      expect(selection.ambiguousIbans).toEqual([
        { iban: "NL20KNAB0123456780", externalIds: ["acc-1", "acc-3"] },
      ]);
    });
  });
});
