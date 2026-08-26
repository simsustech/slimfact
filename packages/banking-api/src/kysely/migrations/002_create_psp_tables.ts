import { sql } from "kysely";
import type { Kysely } from "kysely";

/**
 * PSP payout ingestion tables (open_banking schema, shared slimfact DB).
 * `psp_settlements` is the authoritative net-payout record (Mollie settlement
 * / Stripe payout); `psp_payments` maps each PSP payment to the settlement
 * that paid it out. The proxy owns both tables; SlimFact reads them through
 * the tRPC machine API and records link outcomes as checkout.payments rows.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const schema = db.schema.withSchema("open_banking");

  await schema
    .createTable("psp_settlements")
    .addColumn("external_id", "varchar", (col) => col.notNull().unique())
    .addColumn("psp", "varchar", (col) => col.notNull())
    .addColumn("amount_cents", "integer", (col) => col.notNull())
    .addColumn("fee_cents", "integer")
    .addColumn("currency", "varchar", (col) => col.notNull())
    .addColumn("payout_date", "varchar")
    .addColumn("status", "varchar")
    .addColumn("synced_at", "timestamptz")
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();

  await schema
    .createTable("psp_payments")
    .addColumn("psp", "varchar", (col) => col.notNull())
    .addColumn("external_id", "varchar", (col) => col.notNull())
    .addColumn("settlement_id", "varchar")
    .addColumn("amount_cents", "integer", (col) => col.notNull())
    .addColumn("currency", "varchar", (col) => col.notNull())
    .addColumn("status", "varchar")
    .addColumn("paid_at", "timestamptz")
    .addColumn("synced_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addPrimaryKeyConstraint("psp_payments_pkey", ["psp", "external_id"])
    .execute();

  await schema
    .createIndex("psp_payments_settlement_index")
    .on("psp_payments")
    .column("settlement_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const schema = db.schema.withSchema("open_banking");
  await schema.dropTable("psp_payments").execute();
  await schema.dropTable("psp_settlements").execute();
}
