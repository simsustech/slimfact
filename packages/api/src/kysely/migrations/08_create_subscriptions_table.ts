import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('subscriptions')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('uuid', 'uuid', (col) =>
      col.unique().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('name', 'varchar')
    .addColumn('active', 'boolean', (col) => col.defaultTo(false))
    .addColumn('company_id', 'integer', (col) =>
      col.references('companies.id').notNull()
    )
    .addColumn('client_id', 'integer', (col) =>
      col.references('clients.id').notNull()
    )
    .addColumn('number_prefix_template', 'varchar', (col) => col.notNull())
    .addColumn('locale', 'varchar', (col) => col.notNull())
    .addColumn('currency', 'varchar', (col) => col.notNull())
    .addColumn('lines', 'jsonb', (col) => col.notNull())
    .addColumn('discounts', 'jsonb')
    .addColumn('surcharges', 'jsonb')
    .addColumn('payment_term_days', 'integer', (col) => col.notNull())
    .addColumn('start_date', 'date', (col) => col.notNull())
    .addColumn('end_date', 'date')
    .addColumn('cron_schedule', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())

    .addColumn('created_at', 'text', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('subscriptions').execute()
}
