import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('initial_number_for_prefixes')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('company_id', 'integer', (col) =>
      col.references('companies.id').notNull()
    )
    .addColumn('number_prefix', 'varchar', (col) => col.notNull())
    .addColumn('initial_number', 'integer', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('initial_number_for_prefixes').execute()
}
