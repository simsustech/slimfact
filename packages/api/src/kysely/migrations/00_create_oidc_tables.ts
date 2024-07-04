import {
  oidcPayloads,
  accounts,
  authenticationMethods
} from '@modular-api/fastify-oidc/migrations/kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  return Promise.all([
    await oidcPayloads.up(db),
    await accounts.up(db),
    await authenticationMethods.up(db)
  ]).then(() => {})
}

export async function down(db: Kysely<unknown>): Promise<void> {
  return Promise.all([
    await oidcPayloads.down(db),
    await accounts.down(db),
    await authenticationMethods.down(db)
  ]).then(() => {})
}
