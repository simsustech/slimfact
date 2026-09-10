# Memory

> **How to use this file**: AGENTS.md is your primary reference for the SlimFact project — read it before starting work. It covers architecture, workflows, test patterns, and conventions. Additional project-specific conventions are auto-loaded from `.pi/skills/` by Pi when relevant. After making significant changes, save a dated recap to `.pi/changes/`.

## Project Overview

**SlimFact** is a streamlined invoicing solution built as a monorepo with three main packages. It focuses on immutable invoices, flexible billing (bills → receipts → invoices), and client payment processing.

### Architecture

- **Frontend**: Vue 3 + Quasar + Vitrify (SSR/SSG framework)
- **Backend**: Fastify + tRPC + Kysely (PostgreSQL)
- **PDF Generation**: Typst (modern LaTeX alternative)
- **Authentication**: OpenID Connect (OIDC) via @modular-api/fastify-oidc
- **Payments**: Mollie + Stripe PSP integrations with multi-profile support, configurable payment method routing (ideal → mollie|stripe, creditcard → mollie|stripe)
- **Background Jobs**: pg-boss (PostgreSQL job queue)
- **Banking**: open-banking.io integration for importing own bank transactions , matching incoming credits to invoices or payments, auto-apply strict matches.

### Package Structure

| Package          | Purpose                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `packages/api`   | Fastify server with tRPC routes, database layer, email templates                 |
| `packages/app`   | Vue 3 SSR application, reusable components, pages                                |
| `packages/tools` | Shared utilities: Typst rendering, UBL/Peppol XML, Digiboox export, EPC QR codes |
| `packages/docs`  | VitePress documentation                                                          |

### Key Data Models

- **Companies**: Company profiles with banking details, logos, defaults
- **Clients**: Customer records with billing addresses
- **Invoices**: Core invoice entity (immutable once opened) - supports invoices, bills, receipts
- **Subscriptions**: Recurring invoice generation with cron schedules
- **Number Prefixes**: Configurable invoice numbering templates

### Invoice Status Flow

```
CONCEPT → OPEN → PAID/CANCELLED
BILL → RECEIPT → INVOICE (convertible)
```

### Export Formats

- PDF (Typst-rendered), UBL XML, Peppol XML, Digiboox, CSV

## Code Style Guidelines

- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables
- **Prevent raw SQL — use Kysely methods whenever possible.** Do work in the DB via the Kysely query builder (`eb.fn`, `eb.val`, `eb.ref`, callback `.where((eb) => ...)`), not raw `sql\`...\`` fragments or JS reduce/sort/slice. Check the Kysely API docs (<https://kysely-org.github.io/kysely-apidoc/>) before reaching for raw SQL. Validate before data reaches the DB, not after it comes out.
- **Drawer links**: When adding a new admin page or feature route, check if a corresponding drawer link should be added in `packages/app/src/layouts/MainLayout.vue`. The drawer is the primary navigation — new pages without drawer links are hidden from users.

## Conventions (.pi/skills/)

Pi auto-loads project-specific conventions from `.pi/skills/` when the task matches. These contain detailed rules covering:

- **code-style**: Type assertions, object map lookups, factory param naming, simplicity
- **dates**: Date-fns usage, UTC date iteration, holiday surcharge logic
- **docker**: Build workflow, test stack, local package overlay in Docker
- **env**: Config patterns, `env.read()`, VITE\_ prefix, default placement
- **workflow**: Planning, change tracking, quality checks, documentation, security, Vue conventions

## Development Setup

```bash
pnpm i
docker compose -f docker-compose.dev.yaml up -d
cd packages/api
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" POSTGRES_DB=slimfact pnpm run migrate:latest
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" POSTGRES_DB=slimfact pnpm run seed:test
pnpm run dev
```

Fresh start each dev session:

```bash
docker compose -f docker-compose.dev.yaml down --volumes
docker compose -f docker-compose.dev.yaml up --force-recreate -d
cd packages/api
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" POSTGRES_DB=slimfact POSTGRES_PORT=5433 MODULARAPI_ADMIN_PASSWORD=<password> pnpm run migrate:latest
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" POSTGRES_DB=slimfact POSTGRES_PORT=5433 MODULARAPI_ADMIN_PASSWORD=<password> pnpm run seed:data
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" POSTGRES_DB=slimfact POSTGRES_PORT=5433 MODULARAPI_ADMIN_PASSWORD=<password> pnpm run seed:fake
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm exec vitrify dev -m fastify --host --port 3001
```

Use `seed:test` for E2E test data, `seed:fake` for development exploration. `seed:data` creates production-like data with invoices but requires `MODULARAPI_ADMIN_PASSWORD`. For E2E tests, run `seed:data` + `seed:fake` to get invoices.

For Docker-based dev stack (with Caddy + NetBird for webhook testing), use `docker-compose.test.yaml` instead.

### Dev Server & NetBird Tunnel

The dev server runs on `https://localhost:3001`. NetBird provides a publicly reachable URL (`https://slimfact-dev.eu1.netbird.services`) for PSP webhook callbacks.

| Scenario                | `VITE_API_HOST`  | `PLAYWRIGHT_BASE_URL`    | Notes                                                  |
| ----------------------- | ---------------- | ------------------------ | ------------------------------------------------------ |
| Local dev (no webhooks) | `localhost:3001` | `https://localhost:3001` | Browse to localhost directly                           |
| Webhook testing         | NetBird URL      | NetBird URL              | NetBird routes 443 → local dev server :3001 via tunnel |

To switch, edit `packages/api/.env.development.local` and restart the dev server.

**Why VITE_API_HOST matters**: The OIDC issuer URL is built from `VITE_API_HOST`. If set to the NetBird URL but you browse to localhost, OIDC will error with "Incorrect issuer in meta data" because the issuer doesn't match the page origin.

**Gotcha: stale POSTGRES_HOST**: If you previously ran Docker, `POSTGRES_HOST=database` may linger in your shell env. Unset it: `unset POSTGRES_HOST`.
**Gotcha: one-shot test recipe**: Always start a fresh test run with `down --volumes` so the API re-seeds from scratch, then `build --no-cache api` (so any linked local package overlay is picked up), then `up -d --wait` (so containers are healthy before tests run). `up -d api` without `--wait` returns immediately and the API then crashes on a missing DB if its container was recreated against a stale volume. The one-shot recipe:

```bash
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN)
export LINKED_MODULAR_API_FASTIFY_CHECKOUT_PATH=~/Projects/modular-api/packages/fastify-checkout
docker compose -f docker-compose.test.yaml down --volumes
docker compose -f docker-compose.test.yaml build --no-cache api
docker compose -f docker-compose.test.yaml up -d --wait
cd packages/api && pnpm exec playwright test --workers=1 --config=playwright.nosetup.config.ts
```

`--volumes` drops the DB so the API re-runs migrations + `seed:test` from scratch. `build --no-cache api` rebuilds the image with any local fastify-checkout overlay. `up -d --wait` blocks until every container's healthcheck passes, so the API is ready before Playwright starts.

## Docker Test Stack with Linked Local Packages

The Docker build supports overlaying local packages on top of npm-installed ones via BuildKit `additional_contexts`. Set `LINKED_MODULAR_API_FASTIFY_CHECKOUT_PATH` (or other `LINKED_*` vars) to point at your local copy. The Dockerfile copies, injects a `link:` override into `pnpm-workspace.yaml`, and builds inside Docker — no pre-building needed locally. Unset paths default to `.docker/empty`.

### Full Workflow

```bash
# Set the linked package path
export LINKED_MODULAR_API_FASTIFY_CHECKOUT_PATH=~/Projects/modular-api/packages/fastify-checkout

# Export npm token (required before any docker compose command)
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN)

# Clean build
docker compose -f docker-compose.test.yaml down --volumes
docker compose -f docker-compose.test.yaml build --no-cache api

# Start
docker compose -f docker-compose.test.yaml up -d api
```

The API container runs migrations, seeds `seed:test`, and starts the server. Healthcheck polls every 10s with a 15s start period.

### Build

```bash
pnpm run build  # Builds tools → app → api
```

## Payment Flow

Payment handler code lives in `@modular-api/fastify-checkout`. For local dev, use `pnpm link` or the Docker linked-package overlay.

### Full Payment Lifecycle

```
[Admin] Creates invoice (CONCEPT)
  ↓ Send → status = OPEN
[Customer] Opens /invoice/{uuid}
  ↓ Clicks Pay → selects method
[invoiceHandler.addPaymentToInvoice()] routes to correct PSP handler
  ↓ createPayment() stores row in checkout.payments, returns checkoutUrl
[Customer] Redirected to PSP
  ↓ Completes payment
[PSP] POST /{psp}/webhook → settlePayment() → updates payment row
  ↓ Checks amountPaid >= totalIncludingTax
[invoiceHandler] setInvoiceStatus({ status: PAID })
```

### Payment Method Routing

| Method         | Default PSP             | Env override                                |
| -------------- | ----------------------- | ------------------------------------------- |
| `ideal`        | Mollie                  | `IDEAL_PAYMENT_HANDLER=mollie\|stripe`      |
| `creditcard`   | Stripe                  | `CREDITCARD_PAYMENT_HANDLER=mollie\|stripe` |
| `cash`         | Cash (offline)          | —                                           |
| `bankTransfer` | Bank transfer (offline) | —                                           |
| `pin`          | PIN (offline)           | —                                           |

### Webhook Handling

- **Mollie** (`POST /mollie/webhook`): receives `{ id }`, looks up payment by `externalId`, calls `settlePayment()`. If `amountPaid >= totalIncludingTax` and OPEN → PAID.
- **Stripe** (`POST /stripe/webhook`): receives full event, filters for `checkout.session.completed`, same settle + PAID flow. `webhookSecret` accepted but verification not yet wired.

### Refund Flow

1. `invoiceHandler.refundInvoice()` finds highest-paid PSP payment
2. Calls `refundPayment()` on matching handler (Mollie or Stripe)
3. Handler creates refund via PSP API, stores in `checkout.refunds`

### Test Mode Interactions

- **Mollie**: redirect → select test bank → Pay → select "Paid" → Continue → wait webhook (≤15s)
- **Stripe**: redirect → fill email/name → Submit → authorize if prompted → wait redirect → wait webhook (≤60s)

## Open Banking (Bank Transaction Import)

The open-banking.io integration lives in the **banking-api proxy**
(`packages/banking-api`, `@slimfact/banking-api`): it owns the credentials and
its own pg-boss sync queue, and exposes data over tRPC with per-key API-key
grants (`config.test.json` / `BANKING_API_CONFIG_PATH`). The proxy stores
**complete history** in the shared `slimfact` database under the `open_banking`
schema (incremental sync via `accounts.synced_at`; never deletes).

SlimFact has **no local bank tables** (the create/drop migration pair was
squashed away pre-release — no local bank schema ships): it reads bank data
only through the
proxy and records outcomes as `checkout.payments` rows with
`payments_bank_ref_invoice_unique` on `(transaction_reference, invoice_id)`, created by
`createPaymentsTable` from `@modular-api/fastify-checkout` — migration 02, so a
fresh database gets it with the table; existing instances need it applied by hand).
The company → account mapping is **link-first,
IBAN fallback**: explicit `bank_account_companies` rows (many-to-many — one
company may own several accounts, one account may serve several companies) win;
otherwise the account's IBAN is matched against `companies.iban`. The bank UI is
**two surfaces**: `/admin/payments` (two tabs — the payments ledger, and
**Suggestions** = the review queue of unlinked credits, where Link opens the
single/multi/split/PSP proposal dialog and Dismiss persists to
`bank_suggestion_dismissals`) and `/admin/settings/banking` (connections,
per-account company links, **Sync now** — which pushes progress over the event
bus). `/admin/bank` is a redirect to `/admin/payments`, kept for old links.
**Deterministic E2E (no manual DB writes in tests)**: the banking E2E specs
(`banking-proxy`, `banking-link` — which also covers the company filter and
drawer nav — and `banking-review`) assert against the
**seeded demo world** — they never delete/truncate/insert/UPDATE the database.
The seed (`packages/banking-api/src/seed/test.ts` + the demo block in
`packages/api/src/kysely/seeds/test.ts`) provides everything they need:
conn-knab parked in `RequiresReauth`, conn-rabobank `Active`, six demo
invoices (`2026-0001..0006`: A open, B paid + manual banktransfer, C open, D
open, E paid + linked to `bank:seed-credit-001` + Mollie-paid with
`settlementId setl-seed-001`, F open) and eight transactions
(`seed-credit-001..007` + noise, incl. a 80.00 multi covering D+F) plus
`psp_settlements`/`psp_payments` fixtures. The test stack pins
`BANKING_SYNC_CRON: disabled` so the ingest worker only runs
on the "Sync now" button — no mid-run auto-apply race. A test run must start
from a **fresh stack** (`down --volumes` + `up -d --wait`, or the default
playwright config whose globalSetup does exactly that); re-runs without
reseeding are not supported.

> **Unit tests use a dedicated database**: the vitest unit specs (api +
> banking-api) run against **`slimfact_unit`** (created by
> `docker/initdb/01-create-unit-db.sql` on the postgres container's first
> boot — run `down --volumes` once to pick it up). They can never touch a
> running stack's `slimfact` data; no restart/re-seed needed after `pnpm test`.
> First run against a fresh unit DB requires migrations:
>
> ```bash
> # one-time per fresh slimfact_unit (api + banking-api schemas):
> cd packages/api && POSTGRES_DB=slimfact_unit POSTGRES_PASSWORD="$POSTGRES_PASSWORD" pnpm run migrate:latest
> cd packages/banking-api && POSTGRES_DB=slimfact_unit POSTGRES_PASSWORD="$POSTGRES_PASSWORD" pnpm run migrate:latest
> # then run the units:
> cd packages/api && TEST_DATABASE_URL="postgres://postgres:ufgouifdgjdfg@localhost:5433/slimfact_unit" \
>   POSTGRES_DB=slimfact_unit POSTGRES_PASSWORD="$POSTGRES_PASSWORD" pnpm test
> cd packages/banking-api && POSTGRES_DB=slimfact_unit POSTGRES_PASSWORD="$POSTGRES_PASSWORD" pnpm test
> ```
>
> (The banking-api spec defaults target `slimfact_unit`; do not override
> `POSTGRES_DB` back to `slimfact` for unit runs.)

### SlimFact api env

| Env Var                    | Default              | Description                                                                                    |
| -------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `BANKING_API_URL`          | _(empty — disabled)_ | Proxy base URL (e.g. `http://banking-api` in the test stack).                                  |
| `BANKING_API_KEY`          | _(empty — disabled)_ | `obk_…` key granted read + sync scopes for the own accounts.                                   |
| `BANKING_SYNC_TIMEOUT_MS`  | `120000`             | Wait timeout before polling sync status when no `bank.sync.finished` event arrives.            |
| `ADMIN_NOTIFICATION_EMAIL` | _(empty)_            | Admin "invoice paid" notification address; falls back to the invoice's `companyDetails.email`. |
| `OPENBANKING_SYNC_CRON`    | `0 */4 7-23 * * *`   | (proxy) cron schedule for automatic bank transaction sync.                                     |

### banking-api proxy env

| Env Var                                  | Default                        | Description                                                                                                                 |
| ---------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `OPENBANKING_CREDENTIALS_JSON`           | _(empty — disabled)_           | Base64-encoded `credentials.json` bundle from open-banking.io (contains P-256 **decryption key** — treat like a password).  |
| `OPENBANKING_API_BASE_URL`               | SDK default                    | Optional override for the open-banking.io API base URL.                                                                     |
| `BANKING_API_CONFIG_PATH`                | `/etc/banking-api/config.json` | Mounted JSON file that is the source of truth for API keys + grants (fail-closed at boot).                                  |
| `OPENBANKING_SYNC_COOLDOWN_SECONDS`      | `60`                           | Min seconds between sync runs (pg-boss singleton on send + work).                                                           |
| `OPENBANKING_MIN_SYNC_INTERVAL_SECONDS`  | `60`                           | Per-account min interval between SDK syncs.                                                                                 |
| `RATE_LIMIT_PER_MINUTE`                  | `600`                          | Proxy HTTP rate limit (requests/min per key). Garbage values fail at boot.                                                  |
| `POSTGRES_SSL` / `POSTGRES_SSL_INSECURE` | _(off)_ / `false`              | TLS to Postgres; certificate verification is on by default — set `POSTGRES_SSL_INSECURE=true` only for self-signed dev DBs. |

> The banking-api image **migrates and serves only** — it does not seed. The E2E
> fixture (`seed:test`) is applied by the test stack's `command:`, not the image,
> so the published image is safe to run against real data.

> **Credentials warning**: `OPENBANKING_CREDENTIALS_JSON` holds a P-256 private key for decrypting bank data. Never commit it to git, never log/dump it. Rotate by regenerating the bundle in the open-banking.io dashboard.

**Consent**: open-banking.io consents expire after 180 days. The settings tab shows a `RequiresReauth` warning when a connection needs re-consent. No partial application while lapsed.

## Unit Tests

- `packages/api` has a minimal vitest dev-config (`vitest.config.ts`) so `pnpm test`
  (vitrify test) targets pure-TS unit specs in `packages/api/tests/unit/**` only.
- Unit specs are DB-backed and run against the dedicated **`slimfact_unit`**
  database (see the open-banking section above for the migrate + run recipe) —
  they never touch the stack's `slimfact` data.
- Playwright E2E specs live in `packages/api/tests/e2e/**` and run separately via
  `pnpm run test:e2e` (never collected by the unit runner).

## E2E Testing

### Test Patterns

**Combobox (Quasar QSelect)**: Use `fillComboboxes()` from `helpers.ts` which clicks via `getByLabel()` and picks the first option. `role="combobox"` IS exposed on the QSelect input (Quasar 2.25.1 renders `<input role="combobox" aria-label="...">`), so `getByRole('combobox', { name: '...' })` works — but prefer `getByLabel()` for stability across Quasar versions.

**mkInvoice / mkBill**: After submitting a form, navigate to `/admin/invoices` and `waitForLoadState('networkidle')` before clicking `.q-expansion-item__toggle-icon`.first() — otherwise parallel tests' invoices pollute the list.

**Cash payments**: Cash is admin-side (POS) only, NOT available on the public invoice page. Tests must go through `/admin/invoices` → expand → More → "Add payment" → Cash.

**Stripe `completeStripePayment`**: The `#authorize-test-payment` button only appears for iDEAL flow (5s timeout). Credit card auto-redirects after submit.

**Shared page state**: Prefer `browser.newPage()` + `login()` for each test that creates/modifies data.

**Debug helper**: `tests/e2e/helpers.ts` exports `dumpPage(page, label)` — logs URL, buttons, inputs, and body text.

**Known TLS error in `screenshots-customer.spec.ts`**: the spec downloads the
invoice PDF via Node `fetch`, which rejects the self-signed local stack
certificate with `TypeError: fetch failed` / `unable to get local issuer
certificate` (all 4 variants: en/nl × desktop/mobile). This is pre-existing
and unrelated to app changes — run it with
`NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm exec playwright test tests/e2e/screenshots-customer.spec.ts`.

### Base Test Stack (no PSP)

```bash
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN)
docker compose -f docker-compose.test.yaml down --volumes
docker compose -f docker-compose.test.yaml build --no-cache api
docker compose -f docker-compose.test.yaml up -d api
cd packages/api && pnpm run test:e2e
```

### PSP Test Workflow

```bash
# Prerequisites
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN)
export MOLLIE_API_KEY=$(cat ./env/MOLLIE_API_KEY)
export STRIPE_API_KEY=$(cat ./env/STRIPE_API_KEY)
export STRIPE_WEBHOOK_SECRET=$(cat ./env/STRIPE_WEBHOOK_SECRET)
export NETBIRD_SETUP_KEY=$(cat ./env/NETBIRD_SETUP_KEY)

# CRITICAL: API_HOST must be the NetBird URL — the OIDC issuer is set from this at startup
export API_HOST=slimfact-dev.eu1.netbird.services

# Mollie tests
docker compose -f docker-compose.test.yaml -f docker-compose.test.mollie.yaml down --volumes
docker compose -f docker-compose.test.yaml -f docker-compose.test.mollie.yaml up -d --wait
cd packages/api
unset STRIPE_API_KEY  # ensures only Mollie spec runs
PLAYWRIGHT_BASE_URL=$API_HOST npx playwright test payments-mollie.spec.ts --workers=1 --config=playwright.nosetup.config.ts

# Stripe tests
docker compose -f docker-compose.test.yaml -f docker-compose.test.stripe.yaml down --volumes
docker compose -f docker-compose.test.yaml -f docker-compose.test.stripe.yaml up -d --wait
unset MOLLIE_API_KEY
PLAYWRIGHT_BASE_URL=$API_HOST npx playwright test payments-stripe.spec.ts --workers=1 --config=playwright.nosetup.config.ts
```

> **Why `--config=playwright.nosetup.config.ts`**: The default config's `globalSetup` runs `docker compose down --volumes && build && up -d --wait`. Use nosetup when the stack is already running to avoid a redundant rebuild.
>
> **Why `API_HOST` before `up`**: The OIDC issuer is set at server startup from `API_HOST`. If it defaults to `slimfact.localhost`, the discovery endpoint advertises the wrong issuer, causing `Incorrect issuer in meta data` via the NetBird URL.

### Docker Test Configs

| File                              | Purpose                                   |
| --------------------------------- | ----------------------------------------- |
| `docker-compose.test.yaml`        | Base test setup with DB, MailHog, NetBird |
| `docker-compose.test.mollie.yaml` | Routes iDEAL+creditcard → Mollie          |
| `docker-compose.test.stripe.yaml` | Routes iDEAL+creditcard → Stripe          |

## Quality Checks

> `PI_RTK_BYPASS=1` must be set when running `pnpm run build` inside a Pi session to bypass RTK output compression that hides TypeScript errors.

```bash
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN)

pnpm run lint
pnpm run format:check || pnpm run format:write
PI_RTK_BYPASS=1 pnpm run build

# One-shot test recipe: export linked package paths + token,
# then down → build → up. The linked packages (fastify-checkout, event-bus,
# quasar-components) are needed: the first two because pnpm-workspace.yaml
# pins local overrides, quasar-components because the npm 0.12.9 tarball has
# broken QSelect menus inside dialogs (form E2Es fail without the link).
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN)
export LINKED_MODULAR_API_FASTIFY_CHECKOUT_PATH=~/Projects/modular-api/packages/fastify-checkout
export LINKED_MODULAR_API_EVENT_BUS_PATH=~/Projects/modular-api/packages/event-bus
export LINKED_QUASAR_COMPONENTS_PATH=~/Projects/quasar-components/packages/components
docker compose -f docker-compose.test.yaml down --volumes
docker compose -f docker-compose.test.yaml build --no-cache api
docker compose -f docker-compose.test.yaml up -d --wait
cd packages/api && pnpm run test:e2e
```

## Database

- Migrations: `packages/api/src/kysely/migrations/`
- Seeds: `packages/api/src/kysely/seeds/`
- Types: Generated from DB schema in `types.ts`

## Change Recaps (.pi/changes/)

After significant changes, save a recap to `.pi/changes/YYYY-MM-DD-short-topic.md` listing files changed, what changed, and why.

## Screenshots & Invoice PDF

```bash
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN)
cd packages/api && pnpm exec playwright test tests/e2e/screenshots-customer.spec.ts --project=chromium
cd packages/api && pnpm exec playwright test tests/e2e/screenshots-admin.spec.ts --project=chromium
```

Output: `packages/docs/public/screenshots/` — invoice page screenshots, PDFs, admin/customer pages.
