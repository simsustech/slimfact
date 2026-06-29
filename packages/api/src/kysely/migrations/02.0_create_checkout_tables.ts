import { createCheckoutSchema } from '@modular-api/fastify-checkout/migrations/kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await createCheckoutSchema(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropSchema('checkout').execute()
}
