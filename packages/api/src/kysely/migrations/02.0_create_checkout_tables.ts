import type { Kysely } from 'kysely'
import {
  up as checkoutUp,
  down as checkoutDown
} from '@modular-api/fastify-checkout/migrations/kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await checkoutUp(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await checkoutDown(db)
}
