---
'@slimfact/api': minor
---

Verify the Postgres server certificate when `POSTGRES_SSL` is set. The api pool
and pg-boss used `rejectUnauthorized: false`, so TLS encrypted the connection but
accepted any certificate, including one from a machine in the path.

Verification now follows the banking-api package: on by default, with `CACERT`
for a private CA and `POSTGRES_SSL_INSECURE=true` as the opt-out for self-signed
dev servers. pg-boss receives the same `ssl` option as the pool instead of
`sslmode`/`sslrootcert` in its connection string, which pg reads after the
option, and whose `sslrootcert` expects a file path rather than the PEM in
`CACERT`.

Upgrade note: a deployment that sets `POSTGRES_SSL` against a self-signed
server must now set `CACERT` (the PEM contents) or `POSTGRES_SSL_INSECURE=true`.
