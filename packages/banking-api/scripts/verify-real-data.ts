// One-shot real-data ingestion smoke test.
//
// Proves the PRODUCTION ingestion code (runPspSync + runSync) works against
// real Mollie + open-banking data, into a scratch DB (slimfact_verify) that is
// dropped afterwards. No real data is committed anywhere.
//
// Setup (documented; the script fails loudly if the schemas are absent):
//   1. createdb slimfact_verify
//   2. cd packages/api && POSTGRES_DB=slimfact_verify POSTGRES_PASSWORD=… pnpm run migrate:latest
//   3. cd packages/banking-api && POSTGRES_DB=slimfact_verify POSTGRES_PASSWORD=… pnpm run migrate:latest
//   4. cd packages/banking-api && POSTGRES_DB=slimfact_verify POSTGRES_PASSWORD=… MOLLIE_API_KEY=… OPENBANKING_CREDENTIALS_JSON=… pnpm run verify:real
//
// The script asserts settlements/payments/accounts/transactions were ingested
// and the stored invariants hold, then drops slimfact_verify.

import { CamelCasePlugin, Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { EventBus } from "@modular-api/event-bus";
import { createMollieAdapter } from "../src/banking/pspAdapters.js";
import { runPspSync } from "../src/banking/pspSync.js";
import { createClient, loadCredentials } from "../src/banking/client.js";
import { runSync } from "../src/banking/sync.js";
import { bankEventSchemas } from "../src/events.js";
import type { DB } from "../src/kysely/types.js";

const { Pool } = pg;

const log = {
  info: (message: string, ...args: unknown[]) => console.log(`[verify] ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(`[verify] ${message}`, ...args),
  error: (message: string, ...args: unknown[]) => console.error(`[verify] ${message}`, ...args),
};

const main = async (): Promise<void> => {
  const host = process.env.POSTGRES_HOST || "localhost";
  const port = Number(process.env.POSTGRES_PORT || "5432");
  const user = process.env.POSTGRES_USER || "postgres";
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) throw new Error("POSTGRES_PASSWORD is required");
  const dbName = process.env.POSTGRES_DB || "slimfact_verify";

  const db = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ host, port, user, password, database: dbName, max: 5 }),
    }),
    plugins: [new CamelCasePlugin()],
  }).withSchema("open_banking");

  // Pre-flight: the scratch DB must have both schemas migrated.
  const checkout = await sql<{
    t: string | null;
  }>`select to_regclass('checkout.invoices') as t`.execute(db);
  const openBanking = await sql<{
    t: string | null;
  }>`select to_regclass('open_banking.accounts') as t`.execute(db);
  if (!checkout.rows[0]?.t || !openBanking.rows[0]?.t) {
    throw new Error(
      `slimfact_verify is missing schemas — run both migrate:latest with POSTGRES_DB=${dbName} first`,
    );
  }

  const runId = `verify-${Date.now()}`;

  // --- Mollie PSP ingestion ---
  const mollieApiKey = process.env.MOLLIE_API_KEY;
  if (!mollieApiKey) throw new Error("MOLLIE_API_KEY is required");
  const pspResult = await runPspSync({
    db,
    log,
    runId,
    adapters: { mollie: createMollieAdapter(mollieApiKey) },
  });
  log.info(`psp sync result: ${JSON.stringify(pspResult)}`);

  const settlements = await db.selectFrom("psp_settlements").selectAll().execute();
  const payments = await db.selectFrom("psp_payments").selectAll().execute();
  if (settlements.length === 0) throw new Error("no settlements ingested");
  if (payments.length === 0) throw new Error("no psp payments ingested");

  // Stored invariants (the adapter stores only { reference } in metadata, so
  // the exact Mollie fee split — feeCents = Σ costs.amountNet excl VAT — is
  // covered by the unit specs, not re-derived here). We assert the invariants
  // that hold from the stored rows alone.
  for (const s of settlements) {
    if (!(s.amountCents > 0))
      throw new Error(`settlement ${s.externalId}: amountCents not positive`);
    if (s.feeCents !== null && s.feeCents < 0) {
      throw new Error(`settlement ${s.externalId}: negative feeCents`);
    }
  }
  for (const p of payments) {
    if (!(p.amountCents > 0)) throw new Error(`payment ${p.externalId}: amountCents not positive`);
  }
  // net + fee <= gross per settlement (net = gross − refunds − fee).
  const grossBySettlement = new Map<string, number>();
  for (const p of payments) {
    if (!p.settlementId) continue;
    grossBySettlement.set(
      p.settlementId,
      (grossBySettlement.get(p.settlementId) ?? 0) + p.amountCents,
    );
  }
  for (const s of settlements) {
    const gross = grossBySettlement.get(s.externalId) ?? 0;
    if (gross < s.amountCents + (s.feeCents ?? 0)) {
      throw new Error(
        `settlement ${s.externalId}: gross ${gross} < net ${s.amountCents} + fee ${s.feeCents}`,
      );
    }
  }

  // --- Open-banking ingestion ---
  const credentials = loadCredentials(process.env.OPENBANKING_CREDENTIALS_JSON);
  if (!credentials) throw new Error("OPENBANKING_CREDENTIALS_JSON is missing or invalid");
  const client = createClient(credentials, process.env.OPENBANKING_API_BASE_URL);
  const bus = new EventBus(bankEventSchemas);
  const syncResult = await runSync({ db, client, bus, log, runId });
  log.info(`open-banking sync result: ${JSON.stringify(syncResult)}`);

  const accounts = await db.selectFrom("accounts").selectAll().execute();
  const transactions = await db.selectFrom("transactions").selectAll().execute();
  if (accounts.length === 0) throw new Error("no accounts ingested");
  if (transactions.length === 0) throw new Error("no transactions ingested");

  console.log(
    `[verify] OK: settlements=${settlements.length} payments=${payments.length} accounts=${accounts.length} transactions=${transactions.length}`,
  );

  // Clean up: drop the scratch DB.
  await db.destroy();
  const admin = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({ host, port, user, password, database: "postgres", max: 1 }),
    }),
  });
  await sql`DROP DATABASE IF EXISTS ${sql.ref(dbName)} WITH (FORCE)`.execute(admin);
  await admin.destroy();
  console.log(`[verify] dropped ${dbName}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
