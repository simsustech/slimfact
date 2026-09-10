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

- **Docker** (with BuildKit — the default on modern Docker)
- **Postgres** reachable from the container. The same server SlimFact uses is
  fine; banking-api keeps its own `open_banking` schema.
- A [open-banking.io](https://open-banking.io) account with your bank(s)
  connected, and the exported **credentials bundle** (`credentials.json`)
- Access to the **`@modular-api` registry** (`npm.simsus.tech`) — building the
  image installs those packages, so you need a token.

## Setup with Docker

### 1. Build the image

The image is not published to a registry, so build it from the repository:

```sh
export SIMSUSTECH_NPM_TOKEN=$(cat env/SIMSUSTECH_NPM_TOKEN)

docker build \
  --secret id=SIMSUSTECH_NPM_TOKEN,src=env/SIMSUSTECH_NPM_TOKEN \
  --target banking-api \
  -t banking-api \
  .
```

The secret is only used to authenticate the private `@modular-api` registry
during install; it is not baked into the image.

### 2. First boot (bootstrap)

Banking-api authenticates its callers (SlimFact) with API keys from a mounted
JSON file. Only the SHA-256 hash of each key is stored in the DB; the file is the
source of truth and startup **fails closed** if it is missing or invalid, so the
container cannot start without one.

Keys grant **specific** bank accounts. An empty `accounts` array grants **no**
accounts — not all of them. Since account ids only appear once a sync has run,
the config is built in two passes.

Start with a placeholder so the container boots and pulls the first data:

```sh
printf '{"apiKeys": []}\n' > config.json

export OPENBANKING_CREDENTIALS_JSON=$(base64 -w0 path/to/credentials.json)

docker run -d --name banking-api --restart unless-stopped \
  -e API_HOST=banking-api \
  -e POSTGRES_HOST=<host> \
  -e POSTGRES_DB=<db> \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=<password> \
  -e OPENBANKING_CREDENTIALS_JSON="$OPENBANKING_CREDENTIALS_JSON" \
  -v "$PWD/config.json:/etc/banking-api/config.json:ro" \
  banking-api
```

`API_HOST` is the canonical hostname this instance is reached at; it must match
what SlimFact uses as `BANKING_API_URL` or the OIDC/event-bus origins will
disagree.

The credentials bundle holds the P-256 decryption key and API key — **treat it
like a password**. Pass it via the environment (as above), never by committing
it or copying it into the image.

### 3. Generate the real config

Once the first sync has populated accounts, let banking-api generate the config
itself — it picks a key, grants every account it found, and prints what SlimFact
needs:

```sh
docker exec banking-api node dist/scripts/bootstrap-config.js /tmp/config.json
docker cp banking-api:/tmp/config.json ./config.json
```

Or, running from source against the same database:

```sh
pnpm --filter @slimfact/banking-api bootstrap-config ./config.json
```

The file is written with mode `0600`. It refuses to overwrite an existing config
unless you pass `--force` (which rotates the key), and it refuses to run at all
before any accounts exist — an empty grant list would silently read nothing.

### 4. Restart to apply the key

```sh
docker restart banking-api
```

Boot reconciles the file into the database. Afterwards:

- `scopes`: `read` and/or `sync`. `sync` gates the sync trigger.
- `accounts`: the external account ids the key may access.
- `expiresAt`: optional — the key stops working after this moment.
- **Rotate/revoke**: edit the file and restart; boot reconciles keys into the
  DB (create/update/reactivate/revoke).

### 5. Verify

```sh
docker logs banking-api                 # migration lines, then "listening on 0.0.0.0:80"
docker exec banking-api \
  node -e "fetch('http://localhost/health').then(r=>r.json()).then(console.log)"
# { ok: true, keys: 1 }
```

`keys` is the number of active API keys loaded from the config file — if it is
`0`, the mounted config was not found or failed validation.

### 6. Point SlimFact at it

Set these on the **SlimFact api** service:

| Variable          | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| `BANKING_API_URL` | `http://banking-api:3000` (or wherever you exposed it) |
| `BANKING_API_KEY` | the `obk_…` key from step 2                            |

Leave both empty to disable Bank Import entirely — SlimFact then hides the
bank UI and makes no calls to the proxy.

## Using docker-compose

The two-phase setup above in one file, joined to an existing SlimFact stack.
`banking-api` shares the `database` service and is reached internally as
`banking-api`, so it needs no published ports.

```yaml
services:
  banking-api:
    image: banking-api # built locally: docker build --target banking-api -t banking-api .
    environment:
      API_HOST: banking-api
      # banking-api reads POSTGRES_PASSWORD directly — it has no _FILE variant.
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_HOST: database
      POSTGRES_DB: ${POSTGRES_DB}
      # Base64 of credentials.json. Omit to boot with bank sync inert.
      OPENBANKING_CREDENTIALS_JSON: ${OPENBANKING_CREDENTIALS_JSON:-}
      # Optional — omit unless you want PSP payout ingestion:
      # MOLLIE_API_KEY: ${MOLLIE_API_KEY:-}
      # STRIPE_API_KEY: ${STRIPE_API_KEY:-}
      BANKING_API_CONFIG_PATH: /etc/banking-api/config.json
    volumes:
      # Start with {"apiKeys": []} and replace it via bootstrap-config: see above.
      - ./config.json:/etc/banking-api/config.json:ro
    depends_on:
      database:
        condition: service_healthy
    restart: unless-stopped

  api:
    environment:
      BANKING_API_URL: http://banking-api:80
      BANKING_API_KEY: ${BANKING_API_KEY}
```

Point `BANKING_API_URL` at the port the container listens on (`PORT`, default
`80`) — both services share the compose network, so no published port is needed.

```sh
docker compose build banking-api
docker compose up -d banking-api api
```

## Do migrations run automatically?

**Yes.** The image entrypoint is:

```sh
node dist/src/kysely/migrate.js && node dist/src/server.js
```

Every container start applies any pending migrations and then serves. Migrations
are idempotent and recorded in `open_banking.kysely_migration`, so restarts and
rolling deployments are safe — there is no separate migration step to run, and
no manual `migrate:latest`.

The first boot creates the `open_banking` schema and the pg-boss queue schema.
The image does **not** seed anything: seeding is opt-in and only the test stack
does it.

## Environment variables

Deployment:

| Variable                  | Required | Default                        | Purpose                                                              |
| ------------------------- | -------- | ------------------------------ | -------------------------------------------------------------------- |
| `API_HOST`                | yes      | —                              | Canonical hostname of this banking-api instance.                     |
| `POSTGRES_PASSWORD`       | yes      | —                              | Postgres password.                                                   |
| `POSTGRES_DB`             | yes      | —                              | Database (SlimFact's, e.g. `slimfact`).                              |
| `POSTGRES_HOST`           | no       | `localhost`                    | Postgres host.                                                       |
| `POSTGRES_PORT`           | no       | `5432`                         | Postgres port.                                                       |
| `POSTGRES_USER`           | no       | `postgres`                     | Postgres user.                                                       |
| `POSTGRES_POOL_MAX`       | no       | `3`                            | Max Postgres connections in the pool.                                |
| `POSTGRES_SSL`            | no       | _(off)_                        | Enable TLS to Postgres.                                              |
| `POSTGRES_SSL_INSECURE`   | no       | `false`                        | Skip certificate verification — self-signed dev servers only.        |
| `CACERT`                  | no       | —                              | CA certificate used to verify the Postgres server.                   |
| `BANKING_API_CONFIG_PATH` | no       | `/etc/banking-api/config.json` | Mounted API-key config file. **Must exist** — boot fails without it. |
| `RATE_LIMIT_PER_MINUTE`   | no       | `600`                          | HTTP rate limit.                                                     |
| `PORT` / `HOST`           | no       | `80` / `0.0.0.0`               | Listen address.                                                      |
| `DEBUG`                   | no       | —                              | Log SQL statements.                                                  |

open-banking.io sync:

| Variable                                | Required | Default            | Purpose                                                           |
| --------------------------------------- | -------- | ------------------ | ----------------------------------------------------------------- |
| `OPENBANKING_CREDENTIALS_JSON`          | no\*     | —                  | Base64 of the credentials bundle. Without it bank sync stays off. |
| `OPENBANKING_API_BASE_URL`              | no       | SDK default        | Override the open-banking.io API base URL.                        |
| `OPENBANKING_SYNC_CRON`                 | no       | `0 */4 7-23 * * *` | Scheduled sync schedule (cron).                                   |
| `OPENBANKING_SYNC_COOLDOWN_SECONDS`     | no       | `60`               | Minimum seconds between syncs.                                    |
| `OPENBANKING_MIN_SYNC_INTERVAL_SECONDS` | no       | `60`               | Minimum interval between sync attempts.                           |

Optional — PSP payout ingestion:

| Variable                    | Required | Default           | Purpose                                       |
| --------------------------- | -------- | ----------------- | --------------------------------------------- |
| `MOLLIE_API_KEY`            | no       | —                 | Enables Mollie settlement sync (PSP payouts). |
| `STRIPE_API_KEY`            | no       | —                 | Enables Stripe payout sync.                   |
| `PSP_SYNC_CRON`             | no       | `0 30 7-23 * * *` | PSP payout sync schedule.                     |
| `PSP_SYNC_COOLDOWN_SECONDS` | no       | `60`              | Minimum seconds between PSP syncs.            |

\* Without credentials the service still boots — keys, read API and the queue
work, but every sync returns an empty result and the sync cron is inert. Useful
for verifying the deployment before wiring up real bank data.

The PSP keys are independent of Bank Import: they exist to match PSP payouts
against bank credits. Leaving both unset skips that pass entirely.

## Running from source

For development inside a checkout, everything the image does can be run
directly:

```sh
pnpm --filter @slimfact/banking-api install
pnpm --filter @slimfact/banking-api build
pnpm --filter @slimfact/banking-api migrate:latest   # creates open_banking + pg-boss schemas
pnpm --filter @slimfact/banking-api start            # listening on 0.0.0.0:80
```

`generate-key` and `list-accounts` are also available as package scripts. The
environment variables above apply unchanged.

## Machine API

`POST /trpc`, Bearer key in the `Authorization` header. Procedures:
`listAccounts`, `getAccount`, `listBalances`, `listTransactions`,
`listConnections`, `getSyncStatus`, `sync` (needs the `sync` scope),
`listPspSettlements`, `listPspPayments`. Sync progress is published as
`bank.sync.*` events on the WebSocket at `/ws`.

> The complete developer reference (all env vars, scripts, config schema) is
> in [`packages/banking-api/README.md`](https://github.com/simsustech/slimfact/blob/main/packages/banking-api/README.md).
