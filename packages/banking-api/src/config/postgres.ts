import { read, required } from "./index.js";

export const postgresConfig = {
  host: read("POSTGRES_HOST") || "localhost",
  user: read("POSTGRES_USER") || "postgres",
  password: required("POSTGRES_PASSWORD"),
  database: required("POSTGRES_DB"),
  port: Number(read("POSTGRES_PORT") || "5432"),
  ssl: read("POSTGRES_SSL"),
  /** TLS verification opt-out — set only for self-signed dev servers. */
  sslInsecure: read("POSTGRES_SSL_INSECURE") === "true",
  poolMax: Number(read("POSTGRES_POOL_MAX") || "3"),
  caCert: read("CACERT"),
  debug: read("DEBUG"),
} as const;
