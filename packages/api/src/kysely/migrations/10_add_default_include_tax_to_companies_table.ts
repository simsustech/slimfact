import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('companies')
    .addColumn('default_include_tax', 'boolean', (col) => col.defaultTo(true))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('companies')
    .dropColumn('default_include_tax')
    .execute()
}
