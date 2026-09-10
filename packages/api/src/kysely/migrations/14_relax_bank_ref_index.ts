import type { Kysely } from 'kysely'

/**
 * Bank-link idempotency index on checkout.payments. Bank-synced credits are
 * ingested as payments rows carrying a `'bank:<txid>'` transaction_reference;
 * the unique index makes the ingest idempotent (a re-run can't double-book a
 * credit) while allowing a single bank credit (e.g. a PSP lump-sum payout) to
 * be split across several invoices — each row shares the reference, but the
 * (reference, invoice) pair stays unique.
 * This replaces the strict `payments_bank_ref_unique` (unique on the reference
 * alone) that migration 12 created: that one forbids splitting a single credit
 * across invoices, so it is dropped first. The drop is `.ifExists()` because a
 * from-scratch database (migrations 11/12 were squashed away pre-release) never
 * ran 12 — but any database that did still carries the index, and leaving it in
 * place silently breaks splits. Index creation and the drop share one migration
 * so both paths converge on the same schema.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .withSchema('checkout')
    .dropIndex('payments_bank_ref_unique')
    .ifExists()
    .execute()

  await db.schema
    .withSchema('checkout')
    .createIndex('payments_bank_ref_invoice_unique')
    .on('payments')
    .columns(['transaction_reference', 'invoice_id'])
    .unique()
    .where((eb) => eb('transaction_reference', 'like', 'bank:%'))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .withSchema('checkout')
    .dropIndex('payments_bank_ref_invoice_unique')
    .ifExists()
    .execute()

  await db.schema
    .withSchema('checkout')
    .createIndex('payments_bank_ref_unique')
    .on('payments')
    .column('transaction_reference')
    .unique()
    .where((eb) => eb('transaction_reference', 'like', 'bank:%'))
    .execute()
}
