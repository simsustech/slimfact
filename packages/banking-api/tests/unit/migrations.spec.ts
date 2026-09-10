import { promises as fs } from "node:fs";
import * as path from "node:path";
import pg from "pg";
import { Kysely, PostgresDialect, sql } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbAvailable = !!process.env.POSTGRES_PASSWORD;

const setRequiredEnv = () => {
  process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
  process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5433";
  process.env.POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
  process.env.POSTGRES_DB = process.env.POSTGRES_DB || "slimfact_unit";
};

const { Pool } = pg;

// The proxy migrations live under the `open_banking` schema (shared slimfact
// DB). The up → assert → down cycle runs inside one Kysely transaction that is
// rolled back afterwards, so the spec cannot clobber the schema state the other
// DB-backed specs rely on (Postgres DDL is transactional).
const ROLLBACK = Symbol("rollback");

describe.skipIf(!dbAvailable)("open_banking migration", () => {
  const envBackup = { ...process.env };
  let db: Kysely<Record<string, Record<string, unknown>>>;

  beforeAll(async () => {
    setRequiredEnv();
    db = new Kysely({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: process.env.POSTGRES_HOST,
          port: Number(process.env.POSTGRES_PORT),
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB,
        }),
      }),
    });
  });

  afterAll(async () => {
    await db?.destroy();
    process.env = { ...envBackup };
  });

  const openBankingTables = async (trx: Kysely<Record<string, Record<string, unknown>>>) => {
    const result = await sql<{ table_name: string }>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'open_banking'
      ORDER BY table_name
    `.execute(trx);
    return result.rows.map((row) => row.table_name);
  };

  it("migrates into the open_banking schema and rolls back cleanly", async () => {
    try {
      await db.transaction().execute(async (trx) => {
        // Force a fresh open_banking regardless of the DB's current state; the
        // drop (like everything else here) is undone by the rollback.
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

        const { error, results } = await migrator.migrateToLatest();
        expect(error).toBeUndefined();
        expect(results?.some((entry) => entry.status === "Success")).toBe(true);

        // All 7 proxy tables land in open_banking, plus the namespaced
        // migration table (and the Migrator's lock table).
        expect(await openBankingTables(trx)).toEqual(
          expect.arrayContaining([
            "accounts",
            "api_key_accounts",
            "api_keys",
            "balances",
            "connections",
            "psp_payments",
            "psp_settlements",
            "sync_runs",
            "transactions",
          ]),
        );
        expect(await openBankingTables(trx)).toContain("kysely_migration");
        expect(await openBankingTables(trx)).toHaveLength(11);

        // migrateDown rolls back one migration at a time, newest first. 004 goes
        // first, and its down() is a deliberate no-op (the dropped table was
        // never used), so a second call is what reaches 003 — the one that drops
        // the psp_payments.description column. Every table, including the PSP
        // tables from 001/002, stays either way.
        const firstDown = await migrator.migrateDown();
        expect(firstDown.error).toBeUndefined();
        expect(firstDown.results?.[0]?.migrationName).toContain("004");
        const downResult = await migrator.migrateDown();
        expect(downResult.error).toBeUndefined();
        expect(downResult.results?.[0]?.migrationName).toContain("003");
        const afterDown = await openBankingTables(trx);
        expect(afterDown).toContain("psp_settlements");
        expect(afterDown).toContain("psp_payments");
        expect(afterDown).toContain("accounts");
        expect(afterDown).toContain("kysely_migration");
        expect(afterDown).toHaveLength(11);
        const paymentColumns = await sql<{ column_name: string }>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'open_banking' AND table_name = 'psp_payments'
        `.execute(trx);
        expect(paymentColumns.rows.map((row) => row.column_name)).not.toContain("description");

        throw ROLLBACK;
      });
      throw new Error("expected the migration transaction to roll back");
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  });
});
