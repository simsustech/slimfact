import { sql } from "kysely";
import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // The proxy shares the slimfact database with the SlimFact api; everything
  // lives under the open_banking schema (naming convention, same DB role).
  await db.schema.createSchema("open_banking").ifNotExists().execute();

  const schema = db.schema.withSchema("open_banking");

  await schema
    .createTable("api_keys")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("label", "varchar", (col) => col.notNull())
    .addColumn("key_hash", "varchar", (col) => col.notNull().unique())
    .addColumn("key_prefix", "varchar", (col) => col.notNull())
    .addColumn("scopes", sql`varchar[]`, (col) => col.notNull().defaultTo(sql`ARRAY['read']`))
    .addColumn("expires_at", "timestamptz")
    .addColumn("revoked_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("last_used_at", "timestamptz")
    .execute();

  await schema
    .createTable("accounts")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("external_id", "varchar", (col) => col.notNull().unique())
    .addColumn("aspsp_name", "varchar", (col) => col.notNull())
    .addColumn("aspsp_country", "varchar", (col) => col.notNull())
    .addColumn("currency", "varchar", (col) => col.notNull())
    .addColumn("account_type", "varchar")
    .addColumn("bic", "varchar")
    .addColumn("iban", "varchar")
    .addColumn("bban", "varchar")
    .addColumn("owner_name", "varchar")
    .addColumn("account_name", "varchar")
    .addColumn("product", "varchar")
    .addColumn("display_name", "varchar")
    .addColumn("needs_reconnect", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("synced_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();

  await schema
    .createTable("api_key_accounts")
    .addColumn("api_key_id", "integer", (col) =>
      col.notNull().references("api_keys.id").onDelete("cascade"),
    )
    .addColumn("account_id", "integer", (col) =>
      col.notNull().references("accounts.id").onDelete("cascade"),
    )
    .addPrimaryKeyConstraint("api_key_accounts_pk", ["api_key_id", "account_id"])
    .execute();

  await schema
    .createTable("balances")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("account_id", "integer", (col) =>
      col.notNull().references("accounts.id").onDelete("cascade"),
    )
    .addColumn("type", "varchar", (col) => col.notNull())
    .addColumn("name", "varchar")
    .addColumn("amount_cents", "integer", (col) => col.notNull())
    .addColumn("currency", "varchar", (col) => col.notNull())
    .addColumn("reference_date", "varchar")
    .addUniqueConstraint("balances_account_type_unique", ["account_id", "type"])
    .execute();

  await schema
    .createTable("transactions")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("account_id", "integer", (col) =>
      col.notNull().references("accounts.id").onDelete("cascade"),
    )
    .addColumn("external_id", "varchar", (col) => col.notNull())
    .addColumn("currency", "varchar", (col) => col.notNull())
    .addColumn("credit_debit", "varchar", (col) => col.notNull())
    .addColumn("status", "varchar")
    .addColumn("booking_date", "varchar")
    .addColumn("value_date", "varchar")
    .addColumn("transaction_date", "varchar")
    .addColumn("bank_transaction_code", "varchar")
    .addColumn("amount_cents", "integer", (col) => col.notNull())
    .addColumn("creditor_name", "varchar")
    .addColumn("creditor_iban", "varchar")
    .addColumn("creditor_bban", "varchar")
    .addColumn("creditor_agent_bic", "varchar")
    .addColumn("debtor_name", "varchar")
    .addColumn("debtor_iban", "varchar")
    .addColumn("debtor_bban", "varchar")
    .addColumn("debtor_agent_bic", "varchar")
    .addColumn("remittance_information", "varchar")
    .addColumn("note", "varchar")
    .addColumn("reference_number", "varchar")
    .addColumn("exchange_rate", "varchar")
    .addColumn("merchant_category_code", "varchar")
    .addColumn("balance_after_transaction_cents", "integer")
    .addColumn("balance_after_currency", "varchar")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addUniqueConstraint("transactions_account_external_unique", ["account_id", "external_id"])
    .execute();

  await schema
    .createIndex("transactions_account_booking_index")
    .on("transactions")
    .columns(["account_id", "booking_date"])
    .execute();

  await schema
    .createTable("connections")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("external_id", "varchar", (col) => col.notNull().unique())
    .addColumn("aspsp_name", "varchar", (col) => col.notNull())
    .addColumn("aspsp_country", "varchar", (col) => col.notNull())
    .addColumn("status", "varchar", (col) => col.notNull())
    .addColumn("valid_until", "varchar", (col) => col.notNull())
    .addColumn("account_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("last_synced_at", "varchar")
    .addColumn("psu_type", "varchar")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();

  await schema
    .createTable("sync_runs")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("run_id", "varchar", (col) => col.notNull().unique())
    .addColumn("status", "varchar", (col) => col.notNull().defaultTo("running"))
    .addColumn("started_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("finished_at", "timestamptz")
    .addColumn("accounts_total", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("accounts_synced", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("accounts_skipped_reauth", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("accounts_skipped_rate_limited", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("error", "varchar")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const schema = db.schema.withSchema("open_banking");

  await schema.dropTable("sync_runs").execute();
  await schema.dropTable("connections").execute();
  await schema.dropTable("transactions").execute();
  await schema.dropTable("balances").execute();
  await schema.dropTable("api_key_accounts").execute();
  await schema.dropTable("accounts").execute();
  await schema.dropTable("api_keys").execute();
  // Note: the open_banking schema itself (with the Migrator's kysely_migration
  // tables) is intentionally kept — migrateDown records its rollback in it
  // right after this runs.
}
