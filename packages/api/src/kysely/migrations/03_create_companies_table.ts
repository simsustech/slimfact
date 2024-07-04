import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('companies')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('prefix', 'varchar', (col) => col.notNull())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('contact_person_name', 'varchar')
    .addColumn('address', 'varchar', (col) => col.notNull())
    .addColumn('postal_code', 'varchar', (col) => col.notNull())
    .addColumn('city', 'varchar', (col) => col.notNull())
    .addColumn('country', 'varchar', (col) => col.notNull())
    .addColumn('telephone_number', 'varchar')
    .addColumn('email', 'varchar', (col) => col.notNull())
    .addColumn('email_bcc', 'varchar')
    .addColumn('website', 'varchar')
    .addColumn('logo_svg', 'text')
    .addColumn('coc_number', 'varchar', (col) => col.notNull())
    .addColumn('vat_id_number', 'varchar', (col) => col.notNull())
    .addColumn('iban', 'varchar', (col) => col.notNull())
    .addColumn('bic', 'varchar', (col) => col.notNull())

    .addColumn('created_at', 'text', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('companies').execute()
}
