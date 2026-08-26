import { sql } from "kysely";
import { db } from "../src/kysely/index.js";

const EXPECTED_TABLES = [
  "api_keys",
  "api_key_accounts",
  "accounts",
  "balances",
  "transactions",
  "connections",
  "sync_runs",
];

async function checkSchema() {
  const result = await sql<{ tableName: string }>`
    select table_name as "tableName"
    from information_schema.tables
    where table_schema = 'public'
  `.execute(db);
  const present = new Set(result.rows.map((row) => row.tableName));
  const missing = EXPECTED_TABLES.filter((table) => !present.has(table));

  if (missing.length > 0) {
    console.error(`Schema check FAILED — missing tables: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`Schema check OK — all ${EXPECTED_TABLES.length} tables present`);
  await db.destroy();
}

checkSchema().catch((error) => {
  console.error(error);
  process.exit(1);
});
