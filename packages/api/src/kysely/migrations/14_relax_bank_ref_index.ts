import type { Kysely } from 'kysely'

/**
 * Bank-link idempotency index on checkout.payments. Bank-synced credits are
 * ingested as payments rows carrying a `'bank:<txid>'` transaction_reference;
 * the unique index makes the ingest idempotent (a re-run can't double-book a
 * credit) while allowing a single bank credit (e.g. a PSP lump-sum payout) to
 * be split across several invoices — each row shares the reference, but the
 * (reference, invoice) pair stays unique.
 *
 * Note: an earlier draft of this migration dropped a strict
 * `payments_bank_ref_unique` (unique on the reference alone) "predecessor".
 * That index never existed in any migration or dump, so the drop was dead
 * code and was removed; this migration only creates the split-friendly index.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
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
}
