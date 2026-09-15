import { sql } from 'kysely'
import type { Kysely } from 'kysely'

/**
 * Dismissed bank-credit suggestions. Suggestions are computed on read (no
 * `open_banking.suggestions` table), so "ignore this suggestion" needs its
 * own marker. Keyed by the bank transaction external id + company id (a
 * shared account can serve several companies, and the same credit may be a
 * suggestion for one company but not another).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('bank_suggestion_dismissals')
    .addColumn('transaction_external_id', 'text', (col) => col.notNull())
    .addColumn('company_id', 'integer', (col) =>
      col.notNull().references('companies.id').onDelete('cascade')
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addPrimaryKeyConstraint('bank_suggestion_dismissals_pkey', [
      'transaction_external_id',
      'company_id'
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('bank_suggestion_dismissals').execute()
}
