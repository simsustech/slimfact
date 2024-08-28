import pg from 'pg'
const { Pool } = pg
import { Kysely, PostgresDialect, CamelCasePlugin } from 'kysely'
import env from '@vitrify/tools/env'
// import type { Database as OidcDatabase } from '@modular-api/fastify-oidc'
import type { DB } from './types.d.ts'
export interface Database extends DB {}

Object.defineProperty(BigInt.prototype, 'toJSON', {
  get() {
    'use strict'
    return () => String(this)
  }
})

const types = pg.types
types.setTypeParser(1700, function (val) {
  return parseFloat(val)
})
types.setTypeParser(1114, (str) => str)
types.setTypeParser(1082, (str) => str)

const dialect = new PostgresDialect({
  pool: new Pool({
    host: env.read('POSTGRES_HOST') || env.read('VITE_POSTGRES_HOST'),
    user:
      env.read('POSTGRES_USER') || env.read('VITE_POSTGRES_USER') || 'postgres',
    password:
      env.read('POSTGRES_PASSWORD') || env.read('VITE_POSTGRES_PASSWORD'),
    database: env.read('POSTGRES_DB') || env.read('VITE_POSTGRES_DB'),
    port: env.read('POSTGRES_PORT') || env.read('VITE_POSTGRES_PORT') || 5432,
    // https://www.digitalocean.com/community/questions/cannot-connect-with-dev-database-due-to-ssl-issue
    ssl:
      env.read('POSTGRES_SSL') || env.read('VITE_POSTGRES_SSL')
        ? {
            rejectUnauthorized: false,
            ca: process.env.CACERT
          }
        : false
  })
})

export const db = new Kysely<Database>({
  dialect,
  plugins: [new CamelCasePlugin()],
  log(event) {
    if (env.read('DEBUG') && event.level === 'query') {
      console.log(event.query.sql)
      console.log(event.query.parameters)
    }
  }
})
