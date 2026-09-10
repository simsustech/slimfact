# @slimfact/banking-api

Bank-account proxy for SlimFact. Owns the open-banking.io credentials and the
bank sync queue, exposes a key-authenticated machine API, and publishes sync
progress on the shared event bus. SlimFact (`packages/api`) reads bank data
**only** through this proxy — it keeps no local bank tables.

> The proxy used to be a small SDK shim inside the SlimFact api. It is now a
> standalone service (this package) so the credentials, the sync queue, and
> the `open_banking` schema live in one place and can be deployed/hardened
> independently.

```
┌──────────────┐   tRPC (Bearer key)   ┌──────────────┐   open-banking.io
│ @slimfact/api │ ────────────────────► │ banking-api  │ ◄──── SDK ─────────
└──────────────┘                        │  (this pkg)  │      (credentials)
        ▲                               └──────────────┘
        │ bank.sync.* events (WS / event bus)
        └────────────────────────────────────┘
```

## What it does

- Syncs bank accounts + transactions from open-banking.io into its own
  `open_banking` schema (Postgres). Complete history is kept; incremental
  syncs resume via `accounts.synced_at`.
- Exposes a **machine tRPC API** (`/trpc`) with per-key grants: `read`
  (accounts, balances, transactions, connections) and `sync` (trigger a sync).
- Runs a pg-boss sync queue (cron + singleton worker) that owns the actual
  open-banking.io SDK calls.
- Publishes `bank.sync.*` progress events on the event bus (WS at `/ws`).
- Ingest PS(P) payouts (Mollie settlements / Stripe payouts) when the
  corresponding PSP keys are configured.

## Setup

### 1. Database

Banking-api shares the SlimFact Postgres; its tables live in the
`open_banking` schema (plus a `pgboss_banking_v11` queue schema).

```sh
pnpm --filter @slimfact/banking-api install
pnpm --filter @slimfact/banking-api build   # tsc → dist/
pnpm --filter @slimfact/banking-api migrate:latest
```

`migrate:latest` needs `POSTGRES_*` env vars (see below) and creates the
schemas if they don't exist.

### 2. Environment variables

All are read from the process env. Required ones abort startup when missing.

| Variable                                | Required | Default                        | Purpose                                                                                         |
| --------------------------------------- | -------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `API_HOST`                              | yes      | —                              | Canonical hostname (used for URLs/links).                                                       |
| `POSTGRES_PASSWORD`                     | yes      | —                              | Postgres password.                                                                              |
| `POSTGRES_DB`                           | yes      | —                              | Postgres database (SlimFact's, e.g. `slimfact`).                                                |
| `POSTGRES_HOST`                         | no       | `localhost`                    | Postgres host.                                                                                  |
| `POSTGRES_PORT`                         | no       | `5432`                         | Postgres port.                                                                                  |
| `POSTGRES_USER`                         | no       | `postgres`                     | Postgres user.                                                                                  |
| `POSTGRES_SSL` / `CACERT`               | no       | —                              | TLS to Postgres (see `packages/api` docs).                                                      |
| `OPENBANKING_CREDENTIALS_JSON`          | no*      | —                              | Base64 of the open-banking.io credentials bundle (see below). Without it bank sync stays inert. |
| `OPENBANKING_API_BASE_URL`              | no       | SDK default                    | Override the open-banking.io API base URL.                                                      |
| `OPENBANKING_SYNC_CRON`                 | no       | `0 */4 7-23 * * *`             | pg-boss cron for scheduled syncs.                                                               |
| `OPENBANKING_SYNC_COOLDOWN_SECONDS`     | no       | `60`                           | Min seconds between syncs.                                                                      |
| `OPENBANKING_MIN_SYNC_INTERVAL_SECONDS` | no       | `60`                           | Min interval between sync attempts.                                                             |
| `MOLLIE_API_KEY`                        | no       | —                              | Enables Mollie settlement sync (PSP payouts).                                                   |
| `STRIPE_API_KEY`                        | no       | —                              | Enables Stripe payout sync.                                                                     |
| `PSP_SYNC_CRON`                         | no       | `0 30 7-23 * * *`              | Cron for PSP payout sync.                                                                       |
| `BANKING_API_CONFIG_PATH`               | no       | `/etc/banking-api/config.json` | Mounted API-key config file (see below).                                                        |
| `RATE_LIMIT_PER_MINUTE`                 | no       | `600`                          | HTTP rate limit.                                                                                |
| `PORT`                                  | no       | `80`                           | Listen port.                                                                                    |
| `HOST`                                  | no       | `0.0.0.0`                      | Listen host.                                                                                    |
| `DEBUG`                                 | no       | —                              | Verbose logging.                                                                                |

\* When `OPENBANKING_CREDENTIALS_JSON` is unset the service still boots (keys,
queue, read API all work) but every sync returns a tame/empty result and the
sync cron is inert — this is the "test mode" used by the e2e stack.

### 3. open-banking.io credentials

Create an account on [open-banking.io](https://open-banking.io), connect your
bank, and export the **credentials bundle** (`credentials.json`). The bundle
contains the P-256 decryption key and API key — treat it like a password.

```sh
export OPENBANKING_CREDENTIALS_JSON=$(base64 -w0 path/to/credentials.json)
```

- The bundle must contain `apiBaseUrl` (e.g. `https://open-banking.io`) and
  the API key/encryption key.
- Never commit `env/credentials.json` or log the bundle; the code reports only
  failure _reasons_, never credential content.

### 4. API keys + config file

Banking-api authenticates machine callers with **API keys** defined in a
mounted JSON config file (`BANKING_API_CONFIG_PATH`). The DB stores only the
SHA-256 hash of each key; the file is the source of truth (fail-closed at
boot: a missing/invalid file aborts startup).

Generate a key (from `packages/banking-api`):

```sh
pnpm generate-key              # test key
pnpm generate-key live         # live key
# key:    obk_test_<43 base64url chars>
# prefix: obk_test_xxxx…
# hash:   <sha256 hex — stored in DB>
```

List the accounts a key may be granted (paste ids into the config):

```sh
pnpm list-accounts   # externalId | aspspName | iban
```

Config file shape (see `config.example.json`):

```json
{
  "apiKeys": [
    {
      "label": "example-key",
      "key": "obk_test_<paste from: pnpm generate-key>",
      "scopes": ["read", "sync"],
      "expiresAt": "2030-01-01T00:00:00Z",
      "accounts": ["<external account id from: pnpm list-accounts>"]
    }
  ]
}
```

- `scopes`: `read` (default) and/or `sync`. `sync` gates the `sync` mutation.
- `accounts`: the external account ids this key may access. Empty = all.
- `expiresAt`: optional ISO date; the key stops working after it.
- **Rotate/revoke**: edit the file and restart — boot reconciles keys into the
  DB (creates/updates/reactivates/revokes, and reports `unknownAccounts` for
  grant ids that don't resolve to a stored account).

### 5. Run

```sh
pnpm --filter @slimfact/banking-api start
# [banking-api] listening on 0.0.0.0:80
```

Health check: `GET /health` → `{ "ok": true, "keys": <count> }`.

### 6. Docker (test stack)

The compose files mount the config and credentials via env:

```sh
export SIMSUSTECH_NPM_TOKEN=$(cat env/SIMSUSTECH_NPM_TOKEN)
export OPENBANKING_CREDENTIALS_JSON=$(base64 -w0 env/credentials.json)
export MOLLIE_API_KEY=$(cat env/MOLLIE_API_KEY)
docker compose -f docker-compose.test.yaml up -d --wait api banking-api
```

Per-stack key configs are `config.test.json` / `config.dump.json`. `config.test.json`
is committed (the shared E2E stack needs it); `config.dump.json` is
**gitignored** because it holds a real key — create it locally from
`config.example.json` with your own key.

## Machine API (tRPC)

Endpoint: `POST /trpc` — Bearer key in the `Authorization` header. All
procedures require a valid, non-revoked, non-expired key; `sync` additionally
requires the `sync` scope.

| Procedure            | Auth     | Input                      | Returns                       |
| -------------------- | -------- | -------------------------- | ----------------------------- |
| `listAccounts`       | read     | —                          | Accounts                      |
| `getAccount`         | read     | `accountId`                | Account                       |
| `listBalances`       | read     | `accountId`                | Balances                      |
| `listTransactions`   | read     | `accountId`, paging/filter | Transaction page              |
| `listConnections`    | read     | —                          | Bank connections + status     |
| `getSyncStatus`      | read     | —                          | Per-account sync status       |
| `sync`               | **sync** | optional `accountId`       | Sync result (triggers a sync) |
| `listPspSettlements` | read     | paging                     | PSP settlements               |
| `listPspPayments`    | read     | paging                     | PSP payments                  |

Events: `GET /ws` (WebSocket) publishes `bank.sync.*` progress — the SlimFact
api subscribes to drive its ingest worker.

## Scripts

| Script                    | Purpose                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `generate-key`            | Generate an `obk_test_*`/`obk_live_*` API key (test default; pass `live`).                                                           |
| `list-accounts`           | Print `externalId \| aspspName \| iban` for every stored account.                                                                    |
| `generate:demo`           | _Moved to_ `pnpm --filter @slimfact/tools generate:demo` — the fixtures now live in `@slimfact/tools/banking/demo`, which owns them. |
| `generate:demo`           | _Moved to_ `pnpm --filter @slimfact/tools generate:demo` — the fixtures now live in `@slimfact/tools/banking/demo`, which owns them. |
| `seed:demo` / `seed:test` | Seed demo/test data (test stack).                                                                                                    |
| `check-schema`            | Verify the DB schema matches the code.                                                                                               |

## Testing

```sh
pnpm --filter @slimfact/banking-api test    # vitest unit
```

End-to-end banking flows live in `packages/api/tests/e2e/` (banking-link,
banking-review, payments-overview) and run against the composed test stack;
see `packages/api/tests/e2e/README`-style headers in those specs.

## Design notes

- SlimFact never deletes bank data; it only records outcomes (a `checkout.payments`
  row with `transaction_reference = 'bank:<txid>'`).
- Keys are stored hashed; the mounted config file is the only plaintext copy.
- The sync queue and the SDK-backed sync are inert until credentials are
  configured (`bankingEnabled()`), so the test stack can run without touching
  open-banking.io.
