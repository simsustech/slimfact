import type { Kysely } from "kysely";
import type { PgBoss } from "pg-boss";
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
import { generateKey } from "../../src/api-keys/keys.js";
import { apiKeyConfigSchema, type ApiKeyConfig } from "../../src/config/keys.js";
import type { DB } from "../../src/kysely/types.js";
import type { TrpcDeps } from "../../src/trpc/index.js";
import type { createAppRouter } from "../../src/trpc/machine.js";

const dbAvailable = !!process.env.POSTGRES_PASSWORD;

const setRequiredEnv = () => {
  process.env.API_HOST = "banking.test";
  process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
  process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5433";
  process.env.POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
  process.env.POSTGRES_DB = process.env.POSTGRES_DB || "slimfact_unit";
};

let originalDefineProperty: typeof Object.defineProperty;
let definePropertySpy: MockInstance;

describe.skipIf(!dbAvailable)("machine procedures", () => {
  const envBackup = { ...process.env };
  let db: Kysely<DB>;
  let deps: TrpcDeps;
  let boss: { send: ReturnType<typeof vi.fn> };
  let router: ReturnType<typeof createAppRouter>;
  let createContextFn: (typeof import("../../src/trpc/index.js"))["createContext"];
  let reconcile: (entries: unknown[]) => Promise<void>;

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
          if (target === BigInt.prototype && prop === "toJSON") return target;
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
    reconcile = async (entries: unknown[]) => {
      await keys.reconcileKeys(db, parseConfig(entries));
    };

    boss = { send: vi.fn().mockResolvedValue("job-1") };
    deps = { db, boss: boss as unknown as PgBoss };

    router = (await import("../../src/trpc/machine.js")).createAppRouter();
    createContextFn = (await import("../../src/trpc/index.js")).createContext;
  });

  afterAll(async () => {
    await db?.destroy();
    definePropertySpy?.mockRestore();
    Object.defineProperty = originalDefineProperty;
    process.env = { ...envBackup };
  });

  const callAs = async (key: string | undefined) => {
    const ctx = await createContextFn(deps)({
      req: { headers: { authorization: key ? `Bearer ${key}` : undefined } },
    } as never);
    return router.createCaller(ctx);
  };

  beforeEach(async () => {
    await db.deleteFrom("psp_payments").execute();
    await db.deleteFrom("psp_settlements").execute();
    await db.deleteFrom("transactions").execute();
    await db.deleteFrom("api_keys").execute();
    await db.deleteFrom("accounts").execute();
    await db.deleteFrom("sync_runs").execute();
    await db
      .insertInto("accounts")
      .values([
        { externalId: "acc-1", aspspName: "Knab", aspspCountry: "NL", currency: "EUR" },
        { externalId: "acc-2", aspspName: "Rabobank", aspspCountry: "NL", currency: "EUR" },
      ])
      .execute();
    const acc1 = await db
      .selectFrom("accounts")
      .select("id")
      .where("externalId", "=", "acc-1")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("transactions")
      .values([
        {
          accountId: acc1.id,
          externalId: "t-1",
          currency: "EUR",
          creditDebit: "CRDT",
          bookingDate: "2026-08-01",
          amountCents: 1234,
        },
        {
          accountId: acc1.id,
          externalId: "t-2",
          currency: "EUR",
          creditDebit: "DBIT",
          bookingDate: "2026-07-01",
          amountCents: 500,
        },
        {
          accountId: acc1.id,
          externalId: "t-3",
          currency: "EUR",
          creditDebit: "CRDT",
          bookingDate: "2026-06-01",
          amountCents: 2500,
        },
      ])
      .execute();
    boss.send.mockClear();
  });

  it("rejects missing and unknown API keys with UNAUTHORIZED", async () => {
    await expect(callAs(undefined).then((c) => c.listAccounts())).rejects.toThrowError(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as unknown as string,
    );
    await expect(
      callAs(`obk_test_${"A".repeat(43)}`).then((c) => c.listAccounts()),
    ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }) as unknown as string);
  });

  it("rejects revoked and expired keys with UNAUTHORIZED", async () => {
    const key1 = generateKey();
    const key2 = generateKey();
    await reconcile([{ label: "a", key: key1, accounts: ["acc-1"] }]);
    await reconcile([{ label: "b", key: key2, accounts: ["acc-1"] }]);

    await expect(callAs(key1).then((c) => c.listAccounts())).rejects.toThrowError(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as unknown as string,
    );

    const expired = generateKey();
    await reconcile([
      { label: "expired", key: expired, expiresAt: "2020-01-01T00:00:00Z", accounts: ["acc-1"] },
    ]);
    await expect(callAs(expired).then((c) => c.listAccounts())).rejects.toThrowError(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as unknown as string,
    );
  });

  it("filters listAccounts to the key grants", async () => {
    const readOnly = generateKey();
    await reconcile([{ label: "ro", key: readOnly, accounts: ["acc-1"] }]);

    const accounts = await callAs(readOnly).then((c) => c.listAccounts());
    expect(accounts.map((account) => account.externalId)).toEqual(["acc-1"]);
  });

  it("returns empty lists for a key with zero grants, not an error", async () => {
    const noGrants = generateKey();
    await reconcile([{ label: "ng", key: noGrants }]);

    const accounts = await callAs(noGrants).then((c) => c.listAccounts());
    expect(accounts).toEqual([]);
  });

  it("hides non-granted accounts (NOT_FOUND)", async () => {
    const key = generateKey();
    await reconcile([{ label: "k", key, accounts: ["acc-1"] }]);

    await expect(
      callAs(key).then((c) => c.getAccount({ accountId: "acc-2" })),
    ).rejects.toThrowError(expect.objectContaining({ code: "NOT_FOUND" }) as unknown as string);
  });

  it("paginates listTransactions and enforces the 200 limit", async () => {
    const key = generateKey();
    await reconcile([{ label: "k", key, accounts: ["acc-1"] }]);

    const page1 = await callAs(key).then((c) =>
      c.listTransactions({ accountId: "acc-1", limit: 2 }),
    );
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);

    const page2 = await callAs(key).then((c) =>
      c.listTransactions({ accountId: "acc-1", limit: 2, offset: 2 }),
    );
    expect(page2.items).toHaveLength(1);

    await expect(
      callAs(key).then((c) => c.listTransactions({ accountId: "acc-1", limit: 201 })),
    ).rejects.toThrowError(expect.objectContaining({ code: "BAD_REQUEST" }) as unknown as string);
  });

  it("filters transactions by booking date window", async () => {
    const key = generateKey();
    await reconcile([{ label: "k", key, accounts: ["acc-1"] }]);

    const result = await callAs(key).then((c) =>
      c.listTransactions({ accountId: "acc-1", from: "2026-07-01", to: "2026-07-31" }),
    );
    expect(result.items.map((item) => item.externalId)).toEqual(["t-2"]);
  });

  it("forbids sync without the sync scope", async () => {
    const readOnly = generateKey();
    await reconcile([{ label: "ro", key: readOnly, scopes: ["read"], accounts: ["acc-1"] }]);

    await expect(callAs(readOnly).then((c) => c.sync())).rejects.toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }) as unknown as string,
    );
  });

  it("sync with the sync scope enqueues and returns { queued, runId } fast (no SDK call)", async () => {
    const key = generateKey();
    await reconcile([{ label: "rw", key, scopes: ["read", "sync"], accounts: ["acc-1"] }]);

    const result = await callAs(key).then((c) => c.sync());
    expect(result.queued).toBe(true);
    expect(result.runId).toBeTypeOf("string");

    expect(boss.send).toHaveBeenCalledWith(
      "syncBankTransactions",
      { runId: result.runId },
      expect.objectContaining({ singletonKey: "sync-all", singletonSeconds: expect.any(Number) }),
    );
    // "Sync now" also enqueues the PSP payout sync queue.
    expect(boss.send).toHaveBeenCalledWith(
      "syncPspSettlements",
      { runId: result.runId },
      expect.objectContaining({ singletonKey: "psp-sync", singletonSeconds: expect.any(Number) }),
    );
  });

  it("listPspSettlements/listPspPayments return seeded rows with filters", async () => {
    const key = generateKey();
    await reconcile([{ label: "k", key, accounts: ["acc-1"] }]);

    await db
      .insertInto("psp_settlements")
      .values([
        {
          externalId: "setl-1",
          psp: "mollie",
          amountCents: 4950,
          currency: "EUR",
          payoutDate: "2026-08-01",
          status: "paidout",
          metadata: JSON.stringify({ reference: "SET-1" }),
        },
        {
          externalId: "setl-2",
          psp: "stripe",
          amountCents: 8000,
          feeCents: 100,
          currency: "EUR",
          payoutDate: "2026-07-01",
          status: "paid",
          metadata: JSON.stringify({}),
        },
      ])
      .execute();
    await db
      .insertInto("psp_payments")
      .values({
        psp: "mollie",
        externalId: "pay-1",
        settlementId: "setl-1",
        amountCents: 2500,
        currency: "EUR",
        status: "paid",
        paidAt: new Date("2026-07-30T10:00:00Z"),
      })
      .execute();

    const mollie = await callAs(key).then((c) => c.listPspSettlements({ psp: "mollie" }));
    expect(mollie.map((s) => s.externalId)).toEqual(["setl-1"]);

    const fromFilter = await callAs(key).then((c) => c.listPspSettlements({ from: "2026-07-15" }));
    expect(fromFilter.map((s) => s.externalId)).toEqual(["setl-1"]);

    const all = await callAs(key).then((c) => c.listPspSettlements({}));
    expect(all).toHaveLength(2);

    const payments = await callAs(key).then((c) => c.listPspPayments({ settlementId: "setl-1" }));
    expect(payments.map((p) => p.externalId)).toEqual(["pay-1"]);
  });
  it("denies getSyncStatus for a key with zero grants", async () => {
    const noGrants = generateKey();
    await reconcile([{ label: "ng", key: noGrants }]);

    await expect(callAs(noGrants).then((c) => c.getSyncStatus())).rejects.toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }) as unknown as string,
    );
  });

  it("returns empty PSP lists for a key with zero grants, not an error", async () => {
    await db
      .insertInto("psp_settlements")
      .values({
        externalId: "setl-ng",
        psp: "mollie",
        amountCents: 100,
        currency: "EUR",
        metadata: JSON.stringify({}),
      })
      .execute();
    await db
      .insertInto("psp_payments")
      .values({
        psp: "mollie",
        externalId: "pay-ng",
        settlementId: "setl-ng",
        amountCents: 100,
        currency: "EUR",
        status: "paid",
      })
      .execute();

    const granted = generateKey();
    const noGrants = generateKey();
    // One reconcile so both keys stay valid (reconcile revokes keys absent
    // from the config).
    await reconcile([
      { label: "g", key: granted, accounts: ["acc-1"] },
      { label: "ng", key: noGrants },
    ]);

    const ungrantedCaller = await callAs(noGrants);
    expect(await ungrantedCaller.listPspSettlements({})).toEqual([]);
    expect(await ungrantedCaller.listPspPayments({})).toEqual([]);

    const grantedCaller = await callAs(granted);
    expect(await grantedCaller.listPspSettlements({})).toHaveLength(1);
    expect(await grantedCaller.listPspPayments({})).toHaveLength(1);
  });

  it("exposes hasError instead of raw sync error detail in getSyncStatus", async () => {
    const key = generateKey();
    await reconcile([{ label: "k", key, accounts: ["acc-1"] }]);
    await db
      .insertInto("sync_runs")
      .values({ runId: "run-err", status: "failed", error: "GET /x failed: secret detail" })
      .execute();

    const status = await callAs(key).then((c) => c.getSyncStatus());
    expect(status.hasError).toBe(true);
    expect((status as Record<string, unknown>).error).toBeUndefined();
    expect(JSON.stringify(status)).not.toContain("secret detail");
  });
});
