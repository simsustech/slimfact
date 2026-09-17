# 2026-09-17 — banking-api per-client deploy + key tooling

## Why

One banking-api serves several clients whose IBANs must not be visible to each
other, and it deploys as its own stack next to each client's stack. Two gaps:
`bootstrap-config` only mints **one** key granting **every** account, so splitting
grants meant hand-editing the JSON; and there was no way to see what a stored key
actually owns without writing SQL.

## What changed

- `docker-compose.banking-api.yaml` (new): standalone banking-api stack — own
  project, no ports/caddy labels, its config + credentials live with it. It joins
  an externally created network (`docker network create simsustech`) that the
  client stack also joins with an `api` alias, so the api reaches it as
  `http://banking-api:80`. Network name is parameterized (`SLIMFACT_NETWORK`) for
  tenants sharing a host.
- `packages/banking-api/scripts/add-key.ts` (new): mints a key and merges it into
  the mounted config granting only the `--iban`/`--account` values given. Writes
  to an explicit out path (the container mount is read-only → `/tmp` +
  `docker cp`), refuses a duplicate label without `--force` (which replaces that
  entry, rotating only that key), refuses unknown/ambiguous IBANs (IBANs are not
  unique across ASPSPs), warns about not-yet-synced ids (dormant grants), and
  never creates the config file implicitly — a blank file would drop keys and
  revoke them at the next boot.
- `packages/banking-api/scripts/list-keys.ts` (new): label | prefix | scopes |
  status per stored key, with the accounts it may read.
- `packages/banking-api/src/config/keys.ts`: `buildKeyEntry`, `upsertKeyEntry`
  (validates key format and the expiry, which the zod schema only checks as a
  string), `resolveAccountSelectors` (sorted ids, so CLI messages are stable).
- `packages/banking-api/package.json`, README, compose header: script aliases and
  documentation.

## Verified

- Both compose stacks render standalone and reference the same external network;
  a container aliased `api` on that network resolves and reaches
  `http://banking-api/health`.
- End-to-end on a throwaway Postgres: three keys with disjoint grants, boot
  reconcile (`created: 3, unknownAccounts: []`), then `list-keys` showing one
  client per IBAN; 10 error paths checked (duplicate label, unknown/ambiguous
  IBAN, bad expiry, missing config, read-only output, unknown flag, `--dry-run`,
  `--help` without `POSTGRES_*`).
- 16 unit tests in `key-entry.spec.ts` + `keys-config.spec.ts`.
