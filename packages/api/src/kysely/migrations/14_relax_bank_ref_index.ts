import type { Kysely } from 'kysely'

/**
 * Bank-link idempotency index on checkout.payments. Bank-synced credits are
 * ingested as payments rows carrying a `'bank:<txid>'` transaction_reference;
 * the unique index makes the ingest idempotent (a re-run can't double-book a
 * credit) while allowing a single bank credit (e.g. a PSP lump-sum payout) to
 * be split across several invoices — each row shares the reference, but the
 * (reference, invoice) pair stays unique.
 * This supersedes the strict `payments_bank_ref_unique` (unique on the reference
 * alone), which forbids splitting one credit across invoices. No released
 * database carries it: migrations 11/12 were squashed away pre-release, so the
 * index has no creator on any branch and does not appear in the production dump.
 * The drop is kept anyway, and is `.ifExists()`, so the migration converges to a
 * known end state instead of assuming its starting state — a developer database
 * built while 12 was still in the migrations folder keeps the strict index, and
 * leaving it in place silently breaks splits (observed on this branch, where a
 * stale build artifact re-introduced it). Adding the relaxed index before
 * removing the strict one would momentarily allow neither: the relaxed index
 * alone still permits every split the strict one did.
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
