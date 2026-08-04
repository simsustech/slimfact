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

## E2E Testing

### Test Patterns

**Combobox (Quasar QSelect)**: Use `fillComboboxes()` from `helpers.ts` which clicks via `getByLabel()` and picks the first option. Never use `role="combobox"` — custom QSelect wrappers (CountrySelect, AccountSelect) don't expose it.

**mkInvoice / mkBill**: After submitting a form, navigate to `/admin/invoices` and `waitForLoadState('networkidle')` before clicking `.q-expansion-item__toggle-icon`.first() — otherwise parallel tests' invoices pollute the list.

**Cash payments**: Cash is admin-side (POS) only, NOT available on the public invoice page. Tests must go through `/admin/invoices` → expand → More → "Add payment" → Cash.

**Stripe `completeStripePayment`**: The `#authorize-test-payment` button only appears for iDEAL flow (5s timeout). Credit card auto-redirects after submit.

**Shared page state**: Prefer `browser.newPage()` + `login()` for each test that creates/modifies data.

**Debug helper**: `tests/e2e/helpers.ts` exports `dumpPage(page, label)` — logs URL, buttons, inputs, and body text.

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

# Base test stack (no PSP)
docker compose -f docker-compose.test.yaml down --volumes
docker compose -f docker-compose.test.yaml build --no-cache api
docker compose -f docker-compose.test.yaml up -d api
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
