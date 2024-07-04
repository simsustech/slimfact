import type { Kysely } from 'kysely'
import {
  up as cartUp,
  down as cartDown
} from '@modular-api/fastify-cart/migrations/kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await cartUp(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await cartDown(db)
}
