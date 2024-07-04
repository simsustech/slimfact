import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('number_prefixes')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar')
    .addColumn('template', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('number_prefixes').execute()
}
