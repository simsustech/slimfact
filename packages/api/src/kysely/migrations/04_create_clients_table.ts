import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('clients')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('number', 'varchar')
    .addColumn('company_name', 'varchar')
    .addColumn('contact_person_name', 'varchar')
    .addColumn('address', 'varchar', (col) => col.notNull())
    .addColumn('postal_code', 'varchar', (col) => col.notNull())
    .addColumn('city', 'varchar', (col) => col.notNull())
    .addColumn('country', 'varchar', (col) => col.notNull())
    .addColumn('email', 'varchar', (col) => col.notNull())

    .addColumn('account_id', 'integer', (col) => col.references('accounts.id'))
    .addColumn('created_at', 'text', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('clients').execute()
}
