import {
  createCheckoutSchema,
  createInvoicesTable,
  createPaymentsTable,
  createRefundsTable
} from '@modular-api/fastify-checkout/migrations/kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await createCheckoutSchema(db)
  await createInvoicesTable(db)
  await createPaymentsTable(db)
  await createRefundsTable(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropSchema('checkout').execute()
}
