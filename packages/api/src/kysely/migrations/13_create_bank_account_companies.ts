import { sql } from 'kysely'
import type { Kysely } from 'kysely'

/**
 * Explicit company ↔ bank-account links (many-to-many): one company can own
 * multiple bank accounts and one account can serve multiple companies (shared
 * operating accounts). Account-centric composite PK — the account is the
 * primary axis, companies are the value set. Resolution is link-first, IBAN
 * fallback (see `src/banking/accountLinks.ts`).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('bank_account_companies')
    .addColumn('account_external_id', 'text', (col) => col.notNull())
    .addColumn('company_id', 'integer', (col) =>
      col.notNull().references('companies.id').onDelete('cascade')
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addPrimaryKeyConstraint('bank_account_companies_pkey', [
      'account_external_id',
      'company_id'
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('bank_account_companies').execute()
}
