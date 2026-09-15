import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Kysely } from "kysely";
import type { DB } from "../../src/kysely/types.js";
import { sql } from "kysely";
import { demoBanking } from "@slimfact/tools/banking/demo/banking";

// DB-backed integrity test for the banking `seed:demo`. Runs against the
// shared slimfact_unit DB (the banking-api specs set POSTGRES_PORT=5433 in
// their setup). The seed upserts open_banking rows; the test asserts
// referential integrity, fixture row counts, and idempotency.

const dbAvailable = !!process.env.POSTGRES_PASSWORD;

const describeDb = dbAvailable ? describe : describe.skip;

let db: Kysely<DB>;
let seedDemo: () => Promise<void>;

const truncate = async () => {
  await sql`TRUNCATE TABLE open_banking.accounts, open_banking.connections,
    open_banking.transactions, open_banking.balances, open_banking.psp_settlements,
    open_banking.psp_payments CASCADE`.execute(db);
};

describeDb("demo seed:demo (banking)", () => {
  // Dynamic imports: src/kysely/index.js requires env vars at module load,
  // so they must only load when the DB is actually available.
  beforeAll(
    async () => {
      process.env.API_HOST = process.env.API_HOST || "banking.test";
      process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
      process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5433";
      process.env.POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
      process.env.POSTGRES_DB = process.env.POSTGRES_DB || "slimfact_unit";

      const kysely = await import("../../src/kysely/index.js");
      const demo = await import("../../src/seed/demo.js");
      db = kysely.db as Kysely<DB>;
      seedDemo = demo.seedDemo;
      await truncate();
      await seedDemo();
    },
    // First connect + full demo seed can exceed the 10s default.
    30000,
  );

  afterAll(async () => {
    await truncate();
    await db.destroy();
  }, 15000);

  it("row counts match the fixture", async () => {
    const accounts = await db.selectFrom("accounts").selectAll().execute();
    expect(accounts.length).toBe(demoBanking.accounts.length);
    const settlements = await db.selectFrom("psp_settlements").selectAll().execute();
    expect(settlements.length).toBe(demoBanking.pspSettlements.length);
    const payments = await db.selectFrom("psp_payments").selectAll().execute();
    expect(payments.length).toBe(demoBanking.pspPayments.length);
    const transactions = await db.selectFrom("transactions").selectAll().execute();
    expect(transactions.length).toBe(demoBanking.transactions.length);
  });

  it("every psp_payment.settlementId exists", async () => {
    const settlements = await db.selectFrom("psp_settlements").select("externalId").execute();
    const ids = new Set(settlements.map((s) => s.externalId));
    const payments = await db.selectFrom("psp_payments").selectAll().execute();
    expect(payments.length).toBeGreaterThan(0);
    for (const p of payments) {
      expect(ids.has(p.settlementId!)).toBe(true);
    }
  });

  it("every transaction.accountId exists", async () => {
    const accounts = await db.selectFrom("accounts").select("id").execute();
    const ids = new Set(accounts.map((a) => a.id));
    const transactions = await db.selectFrom("transactions").selectAll().execute();
    expect(transactions.length).toBeGreaterThan(0);
    for (const t of transactions) {
      expect(ids.has(t.accountId)).toBe(true);
    }
  });

  it("is idempotent (run twice → counts unchanged)", async () => {
    const count = async (
      table:
        | "accounts"
        | "connections"
        | "transactions"
        | "balances"
        | "psp_settlements"
        | "psp_payments",
    ) => (await db.selectFrom(table).selectAll().execute()).length;
    const before = {
      accounts: await count("accounts"),
      connections: await count("connections"),
      transactions: await count("transactions"),
      balances: await count("balances"),
      settlements: await count("psp_settlements"),
      payments: await count("psp_payments"),
    };
    await seedDemo();
    expect(await count("accounts")).toBe(before.accounts);
    expect(await count("connections")).toBe(before.connections);
    expect(await count("transactions")).toBe(before.transactions);
    expect(await count("balances")).toBe(before.balances);
    expect(await count("psp_settlements")).toBe(before.settlements);
    expect(await count("psp_payments")).toBe(before.payments);
  });
});
