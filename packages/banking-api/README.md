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

**Prerequisites.** Docker with BuildKit; Postgres reachable from the container
(SlimFact's is fine); an [open-banking.io](https://open-banking.io) account with
your bank(s) connected and the exported **credentials bundle**; access to the
published image, or — to build it yourself — a token for the private
`@modular-api` registry (`npm.simsus.tech`).

## Deploy with Docker

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
first boot creates the `open_banking` and `pgboss_banking` queue schemas.
Nothing is seeded — seeding is test-only.

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

### Docker Compose

The same setup, joined to an existing SlimFact stack. `banking-api` shares the
`database` service and is reached internally as `banking-api`, so it publishes no
ports.

**Both services must be on the same non-external network.** `BANKING_API_URL`
addresses the service by its Compose name, `banking-api`, which only resolves
between containers sharing a network. Put `banking-api` on the external,
public-facing network — or let it fall to its own project default — and the api
cannot reach it. In the stack below that shared network is `slimfact`, the
non-external one; `web` is the external Caddy network.

> **"Non-external" does not mean "offline".** `external: true` only says the
> network already exists (Compose did not create it, e.g. Caddy's); it has no
> bearing on connectivity. A network Compose creates is a normal bridge with a
> default gateway, so containers on it keep outbound internet through NAT.
> `internal: true` is the setting that actually severs egress — do not use it
> here.

**banking-api needs outbound internet.** It calls open-banking.io, and Mollie or
Stripe when PSP sync is configured, so the host must allow egress to those.
Corporate egress filtering is the usual cause of syncs that connect but never
return data.

`OPENBANKING_API_BASE_URL` can point it at a different API host, but **the proxy
environment variables are not read by default**. The SDK uses the global `fetch`
(undici), which ignores `HTTPS_PROXY`/`NO_PROXY` unless the runtime opts in:

```yaml
environment:
  NODE_USE_ENV_PROXY: "1" # Node 24+: make fetch honour HTTPS_PROXY / NO_PROXY
```

Two caveats. The SDK accepts a custom `fetch` bound to an undici `Dispatcher` for
proxy or custom-CA setups, but `createClient` does not pass one — using that
needs a code change, not configuration. And Mollie/Stripe clients are separate
and were not tested here, so treat proxy support for PSP sync as unverified.

```yaml
services:
  banking-api:
    image: ghcr.io/simsustech/slimfact-banking-api:latest
    environment:
      API_HOST: banking-api
      POSTGRES_HOST: database
      POSTGRES_DB: ${POSTGRES_DB}
      # Secrets, passed as paths — see below.
      POSTGRES_PASSWORD_FILE: /run/secrets/POSTGRES_PASSWORD
      OPENBANKING_CREDENTIALS_JSON_FILE: /run/secrets/OPENBANKING_CREDENTIALS_JSON
      BANKING_API_CONFIG_PATH: /etc/banking-api/config.json
    volumes:
      # Start with {"apiKeys": []}, then replace via bootstrap-config (step 3).
      - ./config.json:/etc/banking-api/config.json:ro
    secrets:
      - POSTGRES_PASSWORD
      - OPENBANKING_CREDENTIALS_JSON
    networks:
      - slimfact
    depends_on:
      database:
        condition: service_healthy
    restart: unless-stopped

  api:
    # Only the two banking variables are shown here. The api still needs its own
    # configuration — API_HOST, POSTGRES_*, OTP_SECRET, OIDC_CLIENT_SECRET,
    # OIDC_COOKIES_KEYS and the MAIL_* / LICENSE_KEY settings — which is what
    # makes it start at all. See the repository README's "Self-Hosted" section.
    environment:
      BANKING_API_URL: http://banking-api:80
      BANKING_API_KEY: ${BANKING_API_KEY}
    networks:
      - slimfact

networks:
  # Non-external, so Compose creates it and services on it resolve each other by
  # name. Not `internal: true` — banking-api still needs outbound internet to
  # reach open-banking.io. The api service is already attached to this one.
  slimfact:

secrets:
  # Already declared by the api/database services; the bundle is the new one.
  POSTGRES_PASSWORD:
    file: ./env/POSTGRES_PASSWORD
  OPENBANKING_CREDENTIALS_JSON:
    file: ./env/OPENBANKING_CREDENTIALS_JSON
```

`./env/OPENBANKING_CREDENTIALS_JSON` is the base64 **text** of the bundle, not
the bundle itself:

```sh
base64 -w0 env/credentials.json > env/OPENBANKING_CREDENTIALS_JSON
chmod 600 env/OPENBANKING_CREDENTIALS_JSON
```

Both `_FILE` suffixes work because `@vitrify/tools/env` — which every config
read goes through — checks `<VAR>`, then `<VAR>_FILE`, then reads the contents of
any value under `/run/secrets`. So the `-e VAR=value` form used in step 2 and
this form are interchangeable; use whichever matches how your stack already
handles `POSTGRES_PASSWORD`.

> The file lookup is silent on failure: if the secret is not mounted where you
> say, the literal path `/run/secrets/…` becomes the value. For
> `POSTGRES_PASSWORD` that surfaces as an authentication error, not a missing
> file — check the mount before suspecting the password.

## Run from source

For working on this package, or for a deploy you build yourself.

```sh
pnpm --filter @slimfact/banking-api install
pnpm --filter @slimfact/banking-api build          # tsc → dist/
pnpm --filter @slimfact/banking-api migrate:latest # needs POSTGRES_* (see below)
pnpm --filter @slimfact/banking-api start
# [banking-api] listening on 0.0.0.0:80
```

`migrate:latest` creates the `open_banking` and `pgboss_banking` schemas if
they don't exist.

## PSP payout sync (optional)

Independent of Bank Import — configure it only if you take payments through
Mollie or Stripe.

**The problem it solves.** PSPs don't pay out per transaction. They batch, and
the money arrives in your bank account as one lump sum, net of fees, days later:

```text
Customer pays 12 invoices via Mollie  →  Mollie holds them
                                         → one €524.18 credit lands in your bank
                                           (€537.00 charged, €12.82 in fees)
```

To the bank matcher that credit is just an unexplained amount — it won't match
any single invoice, so it would sit in the review queue forever.

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
bank import works as normal. Syncs upsert and never delete, so history
accumulates and a re-run reports zero new rows. One PSP failing is logged and
does not abort the other.

## Configuration

### Environment variables

All are read from the process env. Required ones abort startup when missing.

Every variable may also be supplied as `<VAR>_FILE` pointing at a file under
`/run/secrets`, whose contents are read instead — `POSTGRES_PASSWORD_FILE` and
`OPENBANKING_CREDENTIALS_JSON_FILE` are the two you normally want. See
[Docker Compose](#docker-compose).

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
| `MOLLIE_API_KEY`                        | no       | —                              | Pull Mollie settlements.                                            |
| `STRIPE_API_KEY`                        | no       | —                              | Pull Stripe payouts.                                                |
| `PSP_SYNC_CRON`                         | no       | `0 30 7-23 * * *`              | When to sync PSP payouts.                                           |
| `PSP_SYNC_COOLDOWN_SECONDS`             | no       | `60`                           | Minimum seconds between PSP sync runs (pg-boss singleton).          |
| `RATE_LIMIT_PER_MINUTE`                 | no       | `600`                          | HTTP rate limit (requests/min per key). Garbage fails at boot.      |
| `PORT` / `HOST`                         | no       | `80` / `0.0.0.0`               | Listen address.                                                     |
| `DEBUG`                                 | no       | —                              | Log SQL statements.                                                 |

\* Without credentials the service still boots — keys, read API and the queue all
work, but syncs return empty and the cron is inert. Useful for verifying a
deployment before wiring up real bank data.

### open-banking.io credentials

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

### API keys + config file

Banking-api authenticates machine callers with **API keys** defined in a
mounted JSON config file (`BANKING_API_CONFIG_PATH`). The DB stores only the
SHA-256 hash of each key; the file is the source of truth (fail-closed at
boot: a missing/invalid file aborts startup).

Generate a key:

```sh
pnpm generate-key              # from a checkout — test key
pnpm generate-key live         # live key
```

```text
key:    obk_test_<43 base64url chars>
prefix: obk_test_xxxx…
hash:   <sha256 hex — stored in DB>
```

Only the hash reaches the database; the key itself is what you paste into the
config file.

List the accounts a key may be granted (paste the ids into the config):

```sh
pnpm list-accounts   # externalId | aspspName | iban
```

In a container, call the built script directly — the runtime image is
`node:lts-slim` with only the deployed output copied in, so **`pnpm` is not
installed**:

```sh
docker exec banking-api node dist/scripts/generate-key.js
docker exec banking-api node dist/scripts/list-accounts.js
```

`npm run <script>` works too, but the `node dist/…` form is what step 3 uses and
does not depend on the package's script names.

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
- `accounts`: the external account ids this key may access. **Empty means no
  access**, not all — the grant is intersected against the key's ids, so a key
  with none sees an empty list. There is no wildcard; grant accounts explicitly.
- `expiresAt`: optional ISO date; the key stops working after it.
- **Rotate/revoke**: edit the file and restart — boot reconciles keys into the
  DB (creates/updates/reactivates/revokes, and reports `unknownAccounts` for
  grant ids that don't resolve to a stored account).

`bootstrap-config` (see [step 3](#3-generate-the-real-config)) writes this file
for you once accounts exist.

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

| Script                    | Purpose                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `generate-key`            | Generate an `obk_test_*`/`obk_live_*` API key (test default; pass `live`).                                                 |
| `list-accounts`           | Print `externalId \| aspspName \| iban` for every stored account.                                                          |
| `bootstrap-config`        | Write a complete API-key config: generates a key and grants it every account in the DB. Refuses before any account exists. |
| `seed:demo` / `seed:test` | Seed demo/test data (test stack).                                                                                          |

## Testing

```sh
pnpm --filter @slimfact/banking-api test    # vitest unit
```

End-to-end banking flows live in `packages/api/tests/e2e/` (banking-link,
banking-review, payments-overview) and run against the composed test stack.

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

## Design notes

- SlimFact never deletes bank data; it only records outcomes (a `checkout.payments`
  row with `transaction_reference = 'bank:<txid>'`).
- Keys are stored hashed; the mounted config file is the only plaintext copy.
- The sync queue and the SDK-backed sync are inert until credentials are
  configured (`bankingEnabled()`), so the test stack can run without touching
  open-banking.io.
