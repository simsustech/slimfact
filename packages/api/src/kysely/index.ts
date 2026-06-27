import pg from 'pg'
const { Pool } = pg
import { Kysely, PostgresDialect, CamelCasePlugin } from 'kysely'
import { postgresConfig } from '../config/postgres.js'
import type { DB } from './types.js'
export type Database = DB
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

const { host, user, password, database, port, ssl, poolMax, caCert, debug } =
  postgresConfig

const sslConfig = ssl
  ? {
      rejectUnauthorized: false,
      ca: caCert
    }
  : false

const sslMode = ssl
  ? (sslConfig as { rejectUnauthorized: boolean }).rejectUnauthorized
    ? 'prefer'
    : 'no-verify'
  : ''
const sslRootCert = ssl ? ((sslConfig as { ca?: string }).ca ?? '') : ''
export const postgresConnectionString = `postgress://${user}:${password}@${host}:${port}/${database}?sslmode=${sslMode}&sslrootcert=${sslRootCert}`

const dialect = new PostgresDialect({
  pool: new Pool({
    host,
    user,
    password,
    database: database!,
    port: Number(port),
    ssl: sslConfig,
    max: Number(poolMax)
  })
})

export const db = new Kysely<Database>({
  dialect,
  plugins: [new CamelCasePlugin()],
  log(event) {
    if (debug && event.level === 'query') {
      console.log(event.query.sql)
      console.log(event.query.parameters)
    }
  }
})
