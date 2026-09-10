# Bank Import (open-banking)

SlimFact's **Bank Import** connects your real bank accounts through
[open-banking.io](https://open-banking.io). Incoming credits are matched
against open invoices automatically (see the [Administrator Guide
section](/guide/administrator#bank-import) for the day-to-day workflow). This
page is the **setup guide** for self-hosters: what runs where, which
environment variables matter, and how to create the API keys.

## Architecture

A separate service — **banking-api** (`packages/banking-api`,
`@slimfact/banking-api`) — owns the open-banking.io credentials and the bank
sync queue. SlimFact itself never talks to open-banking.io directly and keeps
no local bank tables:

```text
┌──────────────┐   tRPC (Bearer key)   ┌──────────────┐   open-banking.io
│ SlimFact api  │ ────────────────────► │ banking-api  │ ◄──── SDK ─────────
└──────────────┘                        └──────────────┘      (credentials)
        ▲                                      │
        └────── bank.sync.* events (WS) ───────┘
```

Banking-api stores the full account/transaction history in its own
`open_banking` schema (shared Postgres), runs the scheduled syncs, and exposes
a key-authenticated machine API (`/trpc`) that SlimFact calls for accounts,
balances, transactions, connections, and sync triggers.

## Prerequisites

- A [open-banking.io](https://open-banking.io) account with your bank(s)
  connected, and the exported **credentials bundle** (`credentials.json`)
- Postgres (the same server SlimFact uses is fine)
- The composed SlimFact stack (`docker-compose.test.yaml` / the dump overlay)
  or a manual install

## 1. Install, build, migrate

```sh
pnpm --filter @slimfact/banking-api install
pnpm --filter @slimfact/banking-api build   # tsc → dist/
pnpm --filter @slimfact/banking-api migrate:latest
```

`migrate:latest` creates the `open_banking` schema and the pg-boss queue
schema (`pgboss_banking_v11`). It needs the `POSTGRES_*` variables below.

## 2. Environment variables

| Variable                                | Required | Default                        | Purpose                                                           |
| --------------------------------------- | -------- | ------------------------------ | ----------------------------------------------------------------- |
| `API_HOST`                              | yes      | —                              | Canonical hostname of this banking-api instance.                  |
| `POSTGRES_PASSWORD`                     | yes      | —                              | Postgres password.                                                |
| `POSTGRES_DB`                           | yes      | —                              | Database (SlimFact's, e.g. `slimfact_dump`).                      |
| `POSTGRES_HOST`                         | no       | `localhost`                    | Postgres host.                                                    |
| `POSTGRES_PORT`                         | no       | `5432`                         | Postgres port.                                                    |
| `POSTGRES_USER`                         | no       | `postgres`                     | Postgres user.                                                    |
| `OPENBANKING_CREDENTIALS_JSON`          | no*      | —                              | Base64 of the credentials bundle. Without it bank sync stays off. |
| `OPENBANKING_API_BASE_URL`              | no       | SDK default                    | Override the open-banking.io API base URL.                        |
| `OPENBANKING_SYNC_CRON`                 | no       | `0 */4 7-23 * * *`             | Scheduled sync schedule (cron).                                   |
| `OPENBANKING_SYNC_COOLDOWN_SECONDS`     | no       | `60`                           | Minimum seconds between syncs.                                    |
| `OPENBANKING_MIN_SYNC_INTERVAL_SECONDS` | no       | `60`                           | Minimum interval between sync attempts.                           |
| `MOLLIE_API_KEY`                        | no       | —                              | Enables Mollie settlement sync (PSP payouts).                     |
| `STRIPE_API_KEY`                        | no       | —                              | Enables Stripe payout sync.                                       |
| `PSP_SYNC_CRON`                         | no       | `0 30 7-23 * * *`              | PSP payout sync schedule.                                         |
| `BANKING_API_CONFIG_PATH`               | no       | `/etc/banking-api/config.json` | Mounted API-key config file.                                      |
| `RATE_LIMIT_PER_MINUTE`                 | no       | `600`                          | HTTP rate limit.                                                  |
| `PORT` / `HOST`                         | no       | `80` / `0.0.0.0`               | Listen address.                                                   |

\* Without credentials the service still boots — keys, read API and the queue
work, but every sync returns a tame/empty result and the sync cron is inert.
This is the mode the e2e test stack uses.

## 3. Connect open-banking.io

Export the credentials bundle from your open-banking.io account and pass it
base64-encoded:

```sh
export OPENBANKING_CREDENTIALS_JSON=$(base64 -w0 path/to/credentials.json)
```

The bundle holds the P-256 decryption key and API key — **treat it like a
password**. Never commit `env/credentials.json` or log the bundle.

## 4. Create API keys

Banking-api authenticates machine callers (SlimFact) with API keys defined in
a mounted JSON file (`BANKING_API_CONFIG_PATH`). Only the SHA-256 hash of each
key is stored in the DB; the file is the source of truth and startup fails
closed if it is missing or invalid.

Generate a key from `packages/banking-api`:

```sh
pnpm generate-key            # test key:   obk_test_<43 chars>
pnpm generate-key live       # live key:   obk_live_<43 chars>
```

List the accounts a key may be granted:

```sh
pnpm list-accounts   # externalId | aspspName | iban
```

Config file shape (see `packages/banking-api/config.example.json`):

```json
{
  "apiKeys": [
    {
      "label": "slimfact-api",
      "key": "obk_test_<paste from: pnpm generate-key>",
      "scopes": ["read", "sync"],
      "expiresAt": "2030-01-01T00:00:00Z",
      "accounts": ["<external account id from: pnpm list-accounts>"]
    }
  ]
}
```

- `scopes`: `read` (default) and/or `sync`. `sync` gates the sync trigger.
- `accounts`: account ids this key may access; empty = all.
- `expiresAt`: optional — the key stops working after this moment.
- **Rotate/revoke**: edit the file and restart; boot reconciles keys into the
  DB (create/update/reactivate/revoke).

The same key goes into SlimFact's own configuration as `BANKING_API_URL` (the
proxy's address, e.g. `http://banking-api`) and `BANKING_API_KEY`.

## 5. Run

```sh
pnpm --filter @slimfact/banking-api start
# [banking-api] listening on 0.0.0.0:80
```

Health check: `GET /health` → `{ "ok": true, "keys": <count> }`.

## 6. Docker

The composed stacks mount the config and credentials via env:

```sh
export SIMSUSTECH_NPM_TOKEN=$(cat env/SIMSUSTECH_NPM_TOKEN)
export OPENBANKING_CREDENTIALS_JSON=$(base64 -w0 env/credentials.json)
export MOLLIE_API_KEY=$(cat env/MOLLIE_API_KEY)
docker compose -f docker-compose.test.yaml up -d --wait api banking-api
```

Per-stack key configs live in `packages/banking-api/config.test.json` (committed,
needed by the shared E2E stack) and `config.dump.json` (**gitignored** — it holds
a real key, so create it locally from `config.example.json`). See
`scripts/verify-slimfact-dump.sh` for the full real-data (dump) setup.

## Machine API

`POST /trpc`, Bearer key in the `Authorization` header. Procedures:
`listAccounts`, `getAccount`, `listBalances`, `listTransactions`,
`listConnections`, `getSyncStatus`, `sync` (needs the `sync` scope),
`listPspSettlements`, `listPspPayments`. Sync progress is published as
`bank.sync.*` events on the WebSocket at `/ws`.

> The complete developer reference (all env vars, scripts, config schema) is
> in [`packages/banking-api/README.md`](https://github.com/simsustech/slimfact/blob/main/packages/banking-api/README.md).
