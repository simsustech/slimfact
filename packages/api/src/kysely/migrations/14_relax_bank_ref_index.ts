import type { Kysely } from 'kysely'

/**
 * Relaxes the bank-link idempotency index from `transaction_reference`
 * alone to `(transaction_reference, invoice_id)`: a single bank credit (e.g.
 * a PSP lump-sum payout) may now be split across several invoices, each
 * recorded as its own checkout.payments row with the same 'bank:<txid>'
 * reference. The same (reference, invoice) pair stays unique.
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
