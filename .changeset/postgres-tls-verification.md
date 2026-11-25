---
'@slimfact/api': patch
---

Verify the Postgres server certificate when TLS is enabled.

The api connected over TLS with `rejectUnauthorized: false` hardcoded, so `CACERT`
was never used to verify the server and a network MITM could capture the database
credentials. Verification is now the default and a self-signed dev database opts out
with `POSTGRES_SSL_INSECURE=true`, the contract `banking-api` already had. pg-boss
receives the same verified `ssl` object instead of a connection string that put PEM
content into a file-path slot.
