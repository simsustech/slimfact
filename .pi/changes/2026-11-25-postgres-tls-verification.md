# 2026-11-25 — Postgres TLS verification (api)

Security fix: the api connected to Postgres with TLS but never verified the server
certificate (`rejectUnauthorized: false` hardcoded), so a network MITM could capture
the DB credentials. banking-api already verified by default; this brings the api in
line.

## Files changed

- `packages/api/src/config/postgres.ts` — added `sslInsecure` read from
  `POSTGRES_SSL_INSECURE` (default `false`), the explicit opt-out.
- `packages/api/src/kysely/index.ts` — replaced the hardcoded
  `{ rejectUnauthorized: false, ca }` with `buildSslConfig` (verifies by default,
  passes `CACERT` through as the CA), exported `sslConfig`, and removed the broken
  `postgresConnectionString` (also carried a `postgress://` typo and put PEM content
  into a `sslrootcert` file-path slot).
- `packages/api/src/pgboss.ts` — construct `PgBoss` from explicit connection fields
  plus the shared `ssl` object instead of the removed connection string.
- `packages/api/tests/unit/tls-config.spec.ts` — new spec asserting verify-by-default,
  opt-out only via `POSTGRES_SSL_INSECURE=true`, CA passthrough, and TLS off when unset.
- `packages/api/tests/unit/banking/pgboss.spec.ts` — updated the kysely mock
  (`postgresConnectionString` → `sslConfig`).
- `AGENTS.md` — documented `POSTGRES_SSL` / `POSTGRES_SSL_INSECURE` in the api env table.

## Why

Verified by default so a managed/remote DB over TLS is actually protected; the opt-out
is explicit so self-signed dev servers still work, matching the banking-api contract.
