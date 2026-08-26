import pg from "pg";
const { Pool } = pg;
import { Kysely, PostgresDialect, CamelCasePlugin } from "kysely";
import { postgresConfig } from "../config/postgres.js";
import type { DB } from "./types.js";
export type Database = DB;
Object.defineProperty(BigInt.prototype, "toJSON", {
  get() {
    return () => String(this);
  },
});

const types = pg.types;
types.setTypeParser(1700, (val) => parseFloat(val));
types.setTypeParser(1114, (str) => str);
types.setTypeParser(1082, (str) => str);

const { host, user, password, database, port, poolMax, caCert, debug } = postgresConfig;

/**
 * TLS is verified by default (`rejectUnauthorized: true`); set
 * POSTGRES_SSL_INSECURE=true to opt out (self-signed dev servers only).
 */
export const buildSslConfig = (
  sslEnabled: boolean,
  insecure: boolean,
  caCert: string | undefined,
): boolean | { rejectUnauthorized: boolean; ca: string | undefined } =>
  sslEnabled ? { rejectUnauthorized: !insecure, ca: caCert } : false;

const sslConfig = buildSslConfig(!!postgresConfig.ssl, postgresConfig.sslInsecure, caCert);

const dialect = new PostgresDialect({
  pool: new Pool({
    host,
    user,
    password,
    database: database!,
    port: Number(port),
    ssl: sslConfig as boolean | { rejectUnauthorized: boolean; ca: string | undefined },
    max: Number(poolMax),
  }),
});

export const db = new Kysely<Database>({
  dialect,
  plugins: [new CamelCasePlugin()],
  log(event) {
    if (debug && event.level === "query") {
      console.log(event.query.sql);
      console.log(event.query.parameters);
    }
  },
}).withSchema("open_banking");
