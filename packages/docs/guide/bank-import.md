# Bank Import (open-banking)

SlimFact's **Bank Import** connects your real bank accounts through
[open-banking.io](https://open-banking.io) and matches incoming credits against
open invoices. This page covers setup; see the [Administrator
Guide](/guide/administrator#bank-import) for day-to-day use.

## Architecture

A separate service — **banking-api** — owns the open-banking.io credentials and
the sync queue. SlimFact never talks to open-banking.io directly and keeps no
local bank tables:

```text
┌──────────────┐   tRPC (Bearer key)   ┌──────────────┐   open-banking.io
│ SlimFact api  │ ────────────────────► │ banking-api  │ ◄──── SDK ─────────
└──────────────┘                        └──────────────┘      (credentials)
        ▲                                      │
        └────── bank.sync.* events (WS) ───────┘
```

Banking-api keeps the full account and transaction history in its own
`open_banking` schema (shared Postgres), runs the scheduled syncs, and exposes a
key-authenticated machine API (`/trpc`) that SlimFact calls.

## Prerequisites

- **Docker** with BuildKit (the default on modern Docker)
- **Postgres** reachable from the container — the one SlimFact uses is fine
- A [open-banking.io](https://open-banking.io) account with your bank(s)
  connected, and the exported **credentials bundle**
- Access to the published image, or — to build it yourself — a token for the
  private `@modular-api` registry (`npm.simsus.tech`)

## Setup

### 1. Get the image

```sh
docker pull ghcr.io/simsustech/slimfact-banking-api:latest

# Pin a version in production:
docker pull ghcr.io/simsustech/slimfact-banking-api:1.2.3
```

The package is private — if the pull is denied, log in with a token that has
`read:packages`:

```sh
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-username> --password-stdin
```

To build from a checkout instead:

```sh
docker build \
  --secret id=SIMSUSTECH_NPM_TOKEN,src=env/SIMSUSTECH_NPM_TOKEN \
  --target banking-api \
  -t ghcr.io/simsustech/slimfact-banking-api:local \
  .
```

### 2. Boot with a placeholder config

Banking-api authenticates its callers with API keys from a mounted JSON file.
Only each key's SHA-256 hash reaches the database, but the file **must exist** —
startup fails closed without it.

Keys grant **specific** accounts, and account ids only appear once a sync has
run, so this takes two passes. Start with an empty list:

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

`API_HOST` is the hostname this instance is reached at. It must match SlimFact's
`BANKING_API_URL`, or OIDC and event-bus origins will disagree.

The credentials bundle carries the P-256 decryption key — **treat it like a
password**. Pass it through the environment, never by committing it or baking it
into an image.

Migrations run automatically on startup: the image's entrypoint is
`migrate.js && server.js`. They are idempotent and tracked in
`open_banking.kysely_migration`, so restarts and rolling deploys are safe. The
first boot creates the `open_banking` and pg-boss queue schemas. Nothing is
seeded — seeding is test-only.

### 3. Generate the real config

Once the first sync has run, `bootstrap-config` writes a complete config for you.
It does three things: reads the accounts now in the database, generates a key
(`obk_test_…`, or `obk_live_…` with `live`), and writes a config granting that key
**every one of those accounts**.

```sh
docker exec banking-api node dist/scripts/bootstrap-config.js /tmp/config.json
docker cp banking-api:/tmp/config.json ./config.json
```

Written with mode `0600`. It refuses to run before any accounts exist — a key
with an empty `accounts` list reads **nothing**, so the file would be useless. It
also refuses to overwrite an existing config unless you pass `--force`, which
rotates the key.

Edit the file afterwards to narrow the grants, drop them to a single account, or
add a second key for another consumer.

### 4. Restart to apply the key

```sh
docker restart banking-api
```

Boot reconciles the file into the database. Per key:

- `scopes` — `read` and/or `sync`; `sync` gates the sync trigger
- `accounts` — external account ids it may access; **empty means none**
- `expiresAt` — optional; the key stops working after this moment

To rotate or revoke, edit the file and restart.

### 5. Verify, then point SlimFact at it

```sh
docker logs banking-api   # migrations, then "listening on 0.0.0.0:80"
docker exec banking-api \
  node -e "fetch('http://localhost/health').then(r=>r.json()).then(console.log)"
# { ok: true, keys: 1 }
```

`keys` counts the active keys loaded from the config — `0` means the file was not
found or failed validation.

Then set these on the **SlimFact api** service:

| Variable          | Value                                            |
| ----------------- | ------------------------------------------------ |
| `BANKING_API_URL` | `http://banking-api:80` (the container's `PORT`) |
| `BANKING_API_KEY` | the `obk_…` key from step 3                      |

Leave both empty to disable Bank Import entirely — SlimFact then hides the bank
UI and makes no calls to the proxy.

## Docker Compose

The same setup, joined to an existing SlimFact stack. `banking-api` shares the
`database` service and is reached internally as `banking-api`, so it publishes no
ports.

```yaml
services:
  banking-api:
    image: ghcr.io/simsustech/slimfact-banking-api:latest
    environment:
      API_HOST: banking-api
      # Read directly — banking-api has no _FILE variant for this.
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_HOST: database
      POSTGRES_DB: ${POSTGRES_DB}
      # Base64 of credentials.json. Omit to boot with bank sync inert.
      OPENBANKING_CREDENTIALS_JSON: ${OPENBANKING_CREDENTIALS_JSON:-}
      BANKING_API_CONFIG_PATH: /etc/banking-api/config.json
    volumes:
      # Start with {"apiKeys": []}, then replace via bootstrap-config (step 3).
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

## PSP payout sync (optional)

Optional, and independent of Bank Import — configure it only if you take
payments through Mollie or Stripe.

**The problem it solves.** PSPs don't pay out per transaction. They batch, and
the money arrives in your bank account as one lump sum, net of fees, days later:

```text
Customer pays 12 invoices via Mollie  →  Mollie holds them
                                         → one €524.18 credit lands in your bank
                                           (€537.00 charged, €12.82 in fees)
```

To the bank-import matcher that credit is just an unexplained amount — it won't
match any single invoice, so it would sit in the review queue forever.

**What the sync does.** `MOLLIE_API_KEY` / `STRIPE_API_KEY` make banking-api pull
the payout history alongside the bank data, into `open_banking.psp_settlements`
and `psp_payments`:

- **Mollie** — settlements and the payments inside each one, with withheld fees
  summed from the settlement periods.
- **Stripe** — payouts and the balance transactions linked to each payout.

The matcher can then recognise a bank credit as a known payout: it matches on
currency, a booking-date window around the payout date, and **the exact net
amount**. When it matches, the lump sum is attributed to the individual invoices
inside that payout instead of sitting unmatched.

Unset both keys and this pass is skipped entirely — the proxy still boots, and
bank import works as normal.

| Variable                    | Default           | Purpose                                           |
| --------------------------- | ----------------- | ------------------------------------------------- |
| `MOLLIE_API_KEY`            | —                 | Pull Mollie settlements.                          |
| `STRIPE_API_KEY`            | —                 | Pull Stripe payouts.                              |
| `PSP_SYNC_CRON`             | `0 30 7-23 * * *` | When to sync.                                     |
| `PSP_SYNC_COOLDOWN_SECONDS` | `60`              | Minimum seconds between runs (pg-boss singleton). |

Syncs upsert and never delete, so history accumulates and a re-run reports zero
new rows. One PSP failing is logged and does not abort the other.

## Environment variables

| Variable                                | Required | Default                        | Purpose                                                             |
| --------------------------------------- | -------- | ------------------------------ | ------------------------------------------------------------------- |
| `API_HOST`                              | yes      | —                              | Hostname of this instance; must match SlimFact's `BANKING_API_URL`. |
| `POSTGRES_PASSWORD`                     | yes      | —                              | Postgres password.                                                  |
| `POSTGRES_DB`                           | yes      | —                              | Database (SlimFact's, e.g. `slimfact`).                             |
| `POSTGRES_HOST`                         | no       | `localhost`                    | Postgres host.                                                      |
| `POSTGRES_PORT`                         | no       | `5432`                         | Postgres port.                                                      |
| `POSTGRES_USER`                         | no       | `postgres`                     | Postgres user.                                                      |
| `POSTGRES_POOL_MAX`                     | no       | `3`                            | Connection pool size.                                               |
| `POSTGRES_SSL`                          | no       | _(off)_                        | Enable TLS to Postgres.                                             |
| `POSTGRES_SSL_INSECURE`                 | no       | `false`                        | Skip cert verification — self-signed dev servers only.              |
| `CACERT`                                | no       | —                              | CA certificate for verifying the Postgres server.                   |
| `BANKING_API_CONFIG_PATH`               | no       | `/etc/banking-api/config.json` | API-key config file. **Must exist** — boot fails without it.        |
| `OPENBANKING_CREDENTIALS_JSON`          | no\*     | —                              | Base64 credentials bundle. Without it bank sync stays off.          |
| `OPENBANKING_API_BASE_URL`              | no       | SDK default                    | Override the open-banking.io base URL.                              |
| `OPENBANKING_SYNC_CRON`                 | no       | `0 */4 7-23 * * *`             | When to sync bank data.                                             |
| `OPENBANKING_SYNC_COOLDOWN_SECONDS`     | no       | `60`                           | Minimum seconds between syncs.                                      |
| `OPENBANKING_MIN_SYNC_INTERVAL_SECONDS` | no       | `60`                           | Minimum interval between sync attempts per account.                 |
| `RATE_LIMIT_PER_MINUTE`                 | no       | `600`                          | HTTP rate limit.                                                    |
| `PORT` / `HOST`                         | no       | `80` / `0.0.0.0`               | Listen address.                                                     |
| `DEBUG`                                 | no       | —                              | Log SQL statements.                                                 |

\* Without credentials the service still boots — keys, read API and the queue all
work, but syncs return empty and the cron is inert. Useful for verifying a
deployment before wiring up real bank data.

## Machine API

`POST /trpc`, Bearer key in the `Authorization` header. Procedures:
`listAccounts`, `getAccount`, `listBalances`, `listTransactions`,
`listConnections`, `getSyncStatus`, `sync` (needs the `sync` scope),
`listPspSettlements`, `listPspPayments`. Sync progress is published as
`bank.sync.*` events on the WebSocket at `/ws`.

> Full developer reference — every env var, script and config option — is in
> [`packages/banking-api/README.md`](https://github.com/simsustech/slimfact/blob/main/packages/banking-api/README.md).
