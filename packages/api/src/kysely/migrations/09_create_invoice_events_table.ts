import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('invoice_events')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('invoice_id', 'integer', (col) =>
      col.references('checkout.invoices.id').notNull()
    )
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('timestamp', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('invoice_events').execute()
}
