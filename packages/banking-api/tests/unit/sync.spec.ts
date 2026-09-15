import { EventBus } from "@modular-api/event-bus";
import type { Account, Connection, Transaction } from "@open-banking-io/client";
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
import { bankEventSchemas } from "../../src/events.js";
import type { DB } from "../../src/kysely/types.js";
import type { BankingApi } from "../../src/banking/client.js";
import type { runSync } from "../../src/banking/sync.js";

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

const makeClient = (overrides: Partial<BankingApi> = {}): BankingApi => ({
  getConnections: vi.fn(async () => []),
  getAccounts: vi.fn(async () => []),
  sync: vi.fn(async () => ({ newTransactions: 0, totalFetched: 0 })),
  getTransactions: vi.fn(async () => ({ items: [], total: 0 })),
  syncAll: vi.fn(async () => ({ accounts: 0, newTransactions: 0 })),
  ...overrides,
});

const activeConnection: Connection = {
  sessionId: "conn-active",
  aspspName: "Knab",
  aspspCountry: "NL",
  validUntil: "2099-01-01",
  status: "Active",
  accountCount: 1,
  lastSyncedAt: null,
  psuType: null,
};

const expiredConnection: Connection = {
  sessionId: "conn-expired",
  aspspName: "Rabobank",
  aspspCountry: "NL",
  validUntil: "2020-01-01",
  status: "Active",
  accountCount: 1,
  lastSyncedAt: null,
  psuType: null,
};

const knabAccount: Account = {
  id: "acc-a",
  aspspName: "Knab",
  aspspCountry: "NL",
  currency: "EUR",
  accountType: "CACC",
  bic: "KNABNL2H",
  needsReconnect: false,
  iban: "NL00KNAB0000000001",
  bban: null,
  ownerName: "Owner A",
  accountName: "Current",
  product: "Betaalrekening",
  displayName: "Current account",
  balances: [{ type: "ITBD", name: null, amount: "12.34", currency: "EUR", referenceDate: null }],
};

const rabobankAccount: Account = {
  id: "acc-b",
  aspspName: "Rabobank",
  aspspCountry: "NL",
  currency: "EUR",
  accountType: "CACC",
  bic: "RABONL2U",
  needsReconnect: false,
  iban: "NL00RABO0000000002",
  bban: null,
  ownerName: "Owner B",
  accountName: "Current",
  product: "Betaalrekening",
  displayName: null,
  balances: [],
};

const tx = (id: string, amount: string, bookingDate = "2026-08-01"): Transaction => ({
  id,
  currency: "EUR",
  creditDebitIndicator: "CRDT",
  status: "BOOK",
  bookingDate,
  valueDate: null,
  transactionDate: null,
  bankTransactionCode: null,
  amount,
  creditorName: null,
  creditorIban: null,
  creditorBban: null,
  creditorAgentBic: null,
  debtorName: "Debtor",
  debtorIban: "NL00DEBT0000000009",
  debtorBban: null,
  debtorAgentBic: null,
  remittanceInformation: "REF-123",
  note: null,
  referenceNumber: null,
  exchangeRate: null,
  merchantCategoryCode: null,
  balanceAfterTransaction: null,
  balanceAfterCurrency: null,
});

const log = { info: () => {}, warn: () => {}, error: () => {} };

describe.skipIf(!dbAvailable)("sync orchestrator", () => {
  const envBackup = { ...process.env };
  let db: Kysely<DB>;
  let runSyncImpl: typeof runSync;

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
    db = (await import("../../src/kysely/index.js")).db as Kysely<DB>;
    runSyncImpl = (await import("../../src/banking/sync.js")).runSync;
  });

  afterAll(async () => {
    await db?.destroy();
    definePropertySpy?.mockRestore();
    Object.defineProperty = originalDefineProperty;
    process.env = { ...envBackup };
  });

  beforeEach(async () => {
    await db.deleteFrom("transactions").execute();
    await db.deleteFrom("balances").execute();
    await db.deleteFrom("connections").execute();
    await db.deleteFrom("accounts").execute();
    await db.deleteFrom("sync_runs").execute();
  });

  const run = async (client: BankingApi, runId = "r1") => {
    const bus = new EventBus(bankEventSchemas);
    const events: Array<{ topic: string; data: unknown }> = [];
    bus.subscribe("*", (message) => events.push(message));
    const result = await runSyncImpl({ db, client, bus, log, runId });
    return { result, events };
  };

  it("persists connections/accounts/balances/transactions (decimal → cents), dedupes, and publishes started → finished", async () => {
    const client = makeClient({
      getConnections: async () => [activeConnection, expiredConnection],
      getAccounts: async () => [knabAccount, rabobankAccount],
      getTransactions: async () => ({
        items: [tx("tx-1", "12.34"), tx("tx-2", "-5.00")],
        total: 2,
      }),
    });
    const { result, events } = await run(client, "r1");

    expect(result.status).toBe("finished");
    expect(result.accountsTotal).toBe(2);
    expect(result.accountsSynced).toBe(1);
    expect(result.accountsSkippedReauth).toBe(1);
    expect(result.newTransactions).toBe(2);

    const storedTx = await db
      .selectFrom("transactions")
      .selectAll()
      .orderBy("externalId")
      .execute();
    expect(storedTx.map((row) => row.externalId)).toEqual(["tx-1", "tx-2"]);
    expect(storedTx.find((row) => row.externalId === "tx-1")!.amountCents).toBe(1234);
    expect(storedTx.find((row) => row.externalId === "tx-2")!.amountCents).toBe(-500);

    const storedBalance = await db.selectFrom("balances").selectAll().execute();
    expect(storedBalance).toHaveLength(1);
    expect(storedBalance[0]!.amountCents).toBe(1234);

    expect(
      (await db.selectFrom("connections").selectAll().execute()).map((c) => c.externalId),
    ).toEqual(["conn-active", "conn-expired"]);
    expect(
      (await db.selectFrom("accounts").selectAll().orderBy("externalId").execute()).map(
        (a) => a.externalId,
      ),
    ).toEqual(["acc-a", "acc-b"]);

    const topics = events.map((event) => event.topic);
    expect(topics[0]).toBe("bank.sync.started");
    expect(topics).toContain("bank.connection.requiresReauth");
    expect(topics).toContain("bank.sync.accountSkipped");
    expect(topics).toContain("bank.sync.finished");
    expect(topics.indexOf("bank.sync.started")).toBeLessThan(topics.indexOf("bank.sync.finished"));

    const finished = events.find((event) => event.topic === "bank.sync.finished")!;
    expect(finished.data).toMatchObject({
      runId: "r1",
      status: "finished",
      accountsSynced: 1,
      accountsSkippedReauth: 1,
      newTransactions: 2,
    });

    const requiresReauth = events.find(
      (event) => event.topic === "bank.connection.requiresReauth",
    )!;
    expect(requiresReauth.data).toMatchObject({
      connectionId: "conn-expired",
      aspspName: "Rabobank",
    });

    // sync called for the active account only
    expect(client.sync).toHaveBeenCalledTimes(1);
    expect(client.sync).toHaveBeenCalledWith("acc-a");

    const runRow = await db
      .selectFrom("sync_runs")
      .selectAll()
      .where("runId", "=", "r1")
      .executeTakeFirstOrThrow();
    expect(runRow.status).toBe("finished");
    expect(runRow.finishedAt).not.toBeNull();

    // dedupe: same data again (after clearing syncedAt) inserts nothing new
    await db.updateTable("accounts").set({ syncedAt: null }).execute();
    const second = await run(client, "r2");
    expect(second.result.newTransactions).toBe(0);
  });

  it("paginates through getTransactions until the total is reached", async () => {
    const page1Items = Array.from({ length: 100 }, (_, i) => tx(`tx-p${i}`, `${i + 1}.00`));
    const client = makeClient({
      getConnections: async () => [activeConnection],
      getAccounts: async () => [knabAccount],
      getTransactions: vi.fn(async (_accountId: string, query?: { offset?: number }) => {
        const offset = query?.offset ?? 0;
        if (offset === 0) return { items: page1Items, total: 101 };
        if (offset === 100) return { items: [tx("tx-p100", "101.00")], total: 101 };
        return { items: [], total: 101 };
      }),
    });
    const { result } = await run(client);

    expect(result.newTransactions).toBe(101);
    const stored = await db.selectFrom("transactions").select("externalId").execute();
    expect(stored).toHaveLength(101);
  });

  it("fetches unbounded on first sync, then incrementally from synced_at − 1 day; nothing is deleted", async () => {
    const getTransactions = vi.fn<BankingApi["getTransactions"]>(async () => ({
      items: [tx("tx-inc", "12.34")],
      total: 1,
    }));
    const client = makeClient({
      getConnections: async () => [activeConnection],
      getAccounts: async () => [knabAccount],
      getTransactions,
    });

    // First sync: no synced_at yet → unbounded backfill (no `from`).
    const first = await run(client, "r1");
    expect(first.result.newTransactions).toBe(1);
    expect(getTransactions).toHaveBeenCalledTimes(1);
    expect(getTransactions).toHaveBeenCalledWith(
      "acc-a",
      expect.not.objectContaining({ from: expect.anything() }),
    );

    // Rewind synced_at past the min-interval guard to a fixed timestamp.
    await db
      .updateTable("accounts")
      .set({ syncedAt: new Date("2026-08-10T12:00:00.000Z") })
      .where("externalId", "=", "acc-a")
      .execute();

    const second = await run(client, "r2");
    expect(second.result.newTransactions).toBe(0); // dedupe: tx-inc already stored
    expect(getTransactions).toHaveBeenCalledTimes(2);
    // Incremental cursor: from = synced_at − 1 day → 2026-08-09.
    expect(getTransactions.mock.calls[1]![1]?.from).toBe("2026-08-09");

    // History accumulates: the earlier transaction is still stored, exactly once.
    const stored = await db
      .selectFrom("transactions")
      .select("externalId")
      .where("externalId", "=", "tx-inc")
      .execute();
    expect(stored).toHaveLength(1);
  });

  it("treats a 429 sync failure as rate_limited and does not retry", async () => {
    const client = makeClient({
      getConnections: async () => [activeConnection],
      getAccounts: async () => [knabAccount],
      sync: vi.fn(async () => {
        throw new Error("POST /sync failed: 429");
      }),
    });
    const { result, events } = await run(client);

    expect(result.status).toBe("rate_limited");
    expect(result.accountsSkippedRateLimited).toBe(1);
    expect(events.some((event) => event.topic === "bank.sync.accountSkipped")).toBe(true);
    const skipped = events.find((event) => event.topic === "bank.sync.accountSkipped")!;
    expect(skipped.data).toMatchObject({ accountId: "acc-a", reason: "rate_limited" });
    // no transaction fetch after a failed sync
    expect(client.getTransactions).not.toHaveBeenCalled();
  });

  it("catches an expired-consent sync throw, skips the account, and continues the batch", async () => {
    const client = makeClient({
      getConnections: async () => [activeConnection, expiredConnection],
      getAccounts: async () => [knabAccount, rabobankAccount],
      sync: vi.fn(async (accountId: string) => {
        if (accountId === "acc-b") throw new Error("Account has no active session");
        return { newTransactions: 0, totalFetched: 0 };
      }),
      getTransactions: async () => ({ items: [tx("tx-b", "1.00")], total: 1 }),
    });
    // make acc-b active (not under the expired connection) to hit the throw path
    client.getConnections = async () => [activeConnection];
    const { result, events } = await run(client);

    expect(result.status).toBe("finished");
    expect(result.accountsSynced).toBe(1);
    expect(result.accountsSkippedReauth).toBe(1);
    expect(events.some((event) => event.topic === "bank.sync.failed")).toBe(false);
  });

  it("records a generic sync failure as failed and keeps the run row", async () => {
    const client = makeClient({
      getConnections: async () => [activeConnection],
      getAccounts: async () => [knabAccount],
      sync: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const { result, events } = await run(client, "r-fail");

    expect(result.status).toBe("failed");
    const runRow = await db
      .selectFrom("sync_runs")
      .selectAll()
      .where("runId", "=", "r-fail")
      .executeTakeFirstOrThrow();
    expect(runRow.status).toBe("failed");
    expect(runRow.error).toContain("boom");
    const finished = events.find((event) => event.topic === "bank.sync.finished");
    expect(finished?.data).toMatchObject({ runId: "r-fail", status: "failed" });
    // run-level `bank.sync.failed` is only for catastrophic crashes, not per-account failures
    expect(events.some((event) => event.topic === "bank.sync.failed")).toBe(false);
  });

  it("enforces the per-account min interval (rate-cap guard)", async () => {
    const client = makeClient({
      getConnections: async () => [activeConnection],
      getAccounts: async () => [knabAccount],
      getTransactions: async () => ({ items: [tx("tx-1", "1.00")], total: 1 }),
    });
    await run(client, "r1");
    const second = await run(client, "r2");

    expect(second.result.accountsSynced).toBe(0);
    expect(second.result.accountsSkippedRateLimited).toBe(1);
    const skipped = second.events.find((event) => event.topic === "bank.sync.accountSkipped")!;
    expect(skipped.data).toMatchObject({ reason: "rate_limited" });
  });
});

const DEFAULT_CRON = "0 */4 7-23 * * *";

const makeFakeBoss = () => ({
  start: vi.fn().mockResolvedValue(undefined),
  getSchedules: vi.fn().mockResolvedValue([]),
  getQueue: vi.fn().mockResolvedValue(false),
  createQueue: vi.fn().mockResolvedValue(undefined),
  schedule: vi.fn().mockResolvedValue(undefined),
  work: vi.fn().mockResolvedValue(undefined),
  unschedule: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
});

// pg-boss registration (queue + cron + singleton worker, D14). Uses a fake boss
// and fresh module loads so `bankingEnabled()` re-evaluates per test.
describe("sync queue registration", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterAll(() => {
    vi.resetModules();
    process.env = { ...envBackup };
  });

  it("registers schedule + singleton worker when banking credentials are configured", async () => {
    setRequiredEnv();
    process.env.OPENBANKING_CREDENTIALS_JSON = "c2VjcmV0LXN0dWZm";
    const { initialize } = await import("../../src/pgboss.js");
    const boss = makeFakeBoss();

    await initialize({
      fastify: {
        banking: { db: {} as never, getClient: () => null, eventBus: { bus: {} as never } },
        log,
      },
      boss: boss as never,
    });

    expect(boss.createQueue).toHaveBeenCalledWith("syncBankTransactions");
    expect(boss.schedule).toHaveBeenCalledWith("syncBankTransactions", DEFAULT_CRON, {}, {});
    expect(boss.work).toHaveBeenCalledWith(
      "syncBankTransactions",
      expect.objectContaining({
        batchSize: 1,
        singletonKey: "sync-all",
        singletonSeconds: 60,
        includeMetadata: true,
      }),
      expect.any(Function),
    );
  });

  it("registers the queue even without credentials (tame worker)", async () => {
    setRequiredEnv();
    delete process.env.OPENBANKING_CREDENTIALS_JSON;
    const { initialize } = await import("../../src/pgboss.js");
    const boss = makeFakeBoss();

    await initialize({
      fastify: {
        banking: { db: {} as never, getClient: () => null, eventBus: { bus: {} as never } },
        log,
      },
      boss: boss as never,
    });

    expect(boss.createQueue).toHaveBeenCalledWith("syncBankTransactions");
    expect(boss.work).toHaveBeenCalledWith(
      "syncBankTransactions",
      expect.objectContaining({ batchSize: 1, singletonKey: "sync-all", singletonSeconds: 60 }),
      expect.any(Function),
    );
  });
});
