import { createInvoicesTable } from '@modular-api/fastify-checkout/migrations/kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await createInvoicesTable(db)
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // Down migration handled by 02_create_checkout_tables
}
