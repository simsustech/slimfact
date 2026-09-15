import { promises as fs } from "node:fs";
import * as path from "node:path";
import pg from "pg";
import { CamelCasePlugin, Kysely, PostgresDialect, sql } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PspAdapter } from "../../src/banking/pspSync.js";
import { runPspSync } from "../../src/banking/pspSync.js";
import type { DB } from "../../src/kysely/types.js";

const dbAvailable = !!process.env.POSTGRES_PASSWORD;

const setRequiredEnv = () => {
  process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
  process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5433";
  process.env.POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
  process.env.POSTGRES_DB = process.env.POSTGRES_DB || "slimfact_unit";
};

const { Pool } = pg;

const quietLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

const makeMockMollie = (): PspAdapter => ({
  listSettlements: async () => ({
    items: [
      {
        externalId: "setl-mock-1",
        amountCents: 4950,
        feeCents: 50,
        currency: "EUR",
        payoutDate: "2026-08-01",
        status: "paidout",
        metadata: { source: "mock" },
      },
    ],
  }),
  listSettlementPayments: async () => [
    {
      externalId: "pay-mock-1",
      amountCents: 2500,
      currency: "EUR",
      description: "7ca67d1b-0f9a-47b1-800b-49b8ba0411f9",
      status: "paid",
      paidAt: new Date("2026-07-30T10:00:00Z"),
    },
    {
      externalId: "pay-mock-2",
      amountCents: 2500,
      currency: "EUR",
      description: null,
      status: "paid",
      paidAt: new Date("2026-07-30T11:00:00Z"),
    },
  ],
});

const ROLLBACK = Symbol("rollback");

describe.skipIf(!dbAvailable)("open_banking psp tables", () => {
  const envBackup = { ...process.env };
  let db: Kysely<DB>;

  beforeAll(async () => {
    setRequiredEnv();
    db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: process.env.POSTGRES_HOST,
          port: Number(process.env.POSTGRES_PORT),
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB,
        }),
      }),
      // Mirrors src/kysely/index.ts: CamelCasePlugin + unqualified table names
      // resolve to the open_banking schema.
      plugins: [new CamelCasePlugin()],
    }).withSchema("open_banking");
    // Ensure 002 is applied to the real shared DB (idempotent; the stack's
    // own migrate:latest on the next boot becomes a no-op).
    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.resolve(process.cwd(), "src/kysely/migrations"),
      }),
      migrationTableSchema: "open_banking",
    });
    const { error } = await migrator.migrateToLatest();
    if (error) throw error;
  });

  afterAll(async () => {
    await db?.destroy();
    process.env = { ...envBackup };
  });

  const openBankingTables = async () => {
    const result = await sql<{ tableName: string }>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'open_banking'
      ORDER BY table_name
    `.execute(db);
    // CamelCasePlugin renames the raw result column table_name → tableName.
    return result.rows.map((row) => row.tableName);
  };

  it("migration 002 creates psp_settlements + psp_payments and rolls back cleanly", async () => {
    try {
      await db.transaction().execute(async (trx) => {
        await trx.schema.dropSchema("open_banking").ifExists().cascade().execute();

        const migrator = new Migrator({
          db: trx,
          provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.resolve(process.cwd(), "src/kysely/migrations"),
          }),
          migrationTableSchema: "open_banking",
        });

        const { error } = await migrator.migrateToLatest();
        expect(error).toBeUndefined();

        const tables = await openBankingTables();
        expect(tables).toContain("psp_settlements");
        expect(tables).toContain("psp_payments");
        expect(tables).toContain("kysely_migration");

        throw ROLLBACK;
      });
      throw new Error("expected the migration transaction to roll back");
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  });

  describe("runPspSync", () => {
    const countRows = async (table: "psp_settlements" | "psp_payments") => {
      const row = await db
        .selectFrom(table)
        .select(sql<number>`count(*)::int`.as("count"))
        .executeTakeFirst();
      return Number(row?.count ?? 0);
    };

    beforeEach(async () => {
      await db.deleteFrom("psp_payments").execute();
      await db.deleteFrom("psp_settlements").execute();
    });

    it("upserts settlements + payments and reports 0 new on a second run", async () => {
      const adapters = { mollie: makeMockMollie() };

      const first = await runPspSync({
        db,
        log: quietLogger,
        runId: "run-1",
        adapters,
      });
      expect(first).toEqual({ settlements: 1, payments: 2 });
      expect(await countRows("psp_settlements")).toBe(1);
      expect(await countRows("psp_payments")).toBe(2);

      const row = await db.selectFrom("psp_settlements").selectAll().executeTakeFirstOrThrow();
      expect(row.externalId).toBe("setl-mock-1");
      expect(row.psp).toBe("mollie");
      expect(row.amountCents).toBe(4950);
      expect(row.feeCents).toBe(50);

      const second = await runPspSync({
        db,
        log: quietLogger,
        runId: "run-2",
        adapters,
      });
      expect(second).toEqual({ settlements: 0, payments: 0 });
      expect(await countRows("psp_settlements")).toBe(1);
      expect(await countRows("psp_payments")).toBe(2);
    });

    it("is a no-op when no PSP adapters are configured", async () => {
      const result = await runPspSync({
        db,
        log: quietLogger,
        runId: "run-3",
        adapters: {},
      });
      expect(result).toEqual({ settlements: 0, payments: 0 });
      expect(await countRows("psp_settlements")).toBe(0);
    });
  });
});
