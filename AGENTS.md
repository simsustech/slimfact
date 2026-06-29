# Memory

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
- **Email Templates**: Localized email content

### Invoice Status Flow

```
DRAFT → OPEN → PAID/CANCELLED
BILL → RECEIPT → INVOICE (convertible)
```

### Payment Features

- Mollie online payments (multiple profiles)
- Stripe online payments via Stripe SDK (multiple profiles)
- Payment method routing: env vars `IDEAL_PAYMENT_HANDLER` and `CREDITCARD_PAYMENT_HANDLER`
- Down payment support
- Cash/bank transaction tracking
- Refund processing

### Export Formats

- PDF (Typst-rendered)
- UBL XML (e-invoicing standard)
- Peppol XML
- Digiboox format
- CSV

## Existing Features

### Implemented

- [x] OIDC authentication (headless API capable)
- [x] Invoice/bill/receipt lifecycle
- [x] Subscription billing with cron scheduling
- [x] Multi-language invoices (locale per invoice)
- [x] Tax rate per line (inclusive/exclusive)
- [x] Decimal quantity support
- [x] Mollie payment integration (multi-profile: company-specific API keys via `MOLLIE_API_KEY_<PREFIX>`)
- [x] Stripe payment integration via `stripe` npm SDK (multi-profile: `STRIPE_API_KEY_<PREFIX>`)
- [x] Payment method routing: env vars `IDEAL_PAYMENT_HANDLER=mollie|stripe` and `CREDITCARD_PAYMENT_HANDLER=mollie|stripe` control which PSP handles each method (default: ideal → mollie, creditcard → stripe)
- [x] Email templating with Handlebars
- [x] Email open tracking (pixel)
- [x] EPC QR codes for bank transfers
- [x] Company/client management
- [x] Number prefix templates
- [x] Digiboox, UBL, Peppol exports

## Code Style Guidelines

- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables

## Common Workflows

### Development Setup

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

Use `seed:test` for E2E test data, `seed:fake` for development exploration. `seed:data` creates production-like data with invoices but requires `MODULARAPI_ADMIN_PASSWORD` env var. For E2E tests, run `seed:data` + `seed:fake` to get invoices in the system.

For Docker-based dev stack (with Caddy + NetBird for webhook testing), use `docker-compose.test.yaml` instead.

### Dev Server & NetBird Tunnel

The dev server runs on `https://localhost:3001` via vitrify. For webhook callbacks (Mollie/Stripe), external services need a publicly reachable URL — NetBird provides this via a dedicated subdomain on port 443 (NetBird routes 443 → local dev server).

| Scenario | `VITE_API_HOST` | `PLAYWRIGHT_BASE_URL` | Notes |
|----------|----------------|----------------------|-------|
| Local dev (no webhooks) | `localhost:3001` | `https://localhost:3001` | Browse to localhost directly |
| Webhook testing | NetBird URL | NetBird URL | NetBird routes 443 → local dev server :3001 via tunnel |

To switch, edit `packages/api/.env.development.local` and restart the dev server.

**Why VITE_API_HOST matters**: The OIDC issuer URL is built from `VITE_API_HOST`. If set to the NetBird URL but you browse to localhost, OIDC will error with "Incorrect issuer in meta data" because the issuer doesn't match the page origin. For local dev, use `localhost:3001`. For webhook testing, use the NetBird URL.

**Gotcha: stale POSTGRES_HOST**: If you previously ran Docker, `POSTGRES_HOST=database` may linger in your shell env. The dev server will then try to resolve `database` as a hostname and fail. Unset it: `unset POSTGRES_HOST`.

E2E tests default to `https://localhost:3000`. Override `PLAYWRIGHT_BASE_URL` when needed:

- **Cash/UI tests**: localhost works fine, no override needed
- **PSP tests** (Mollie/Stripe): need NetBird URL for webhook callbacks

```bash
# Cash / UI tests (localhost):
cd packages/api && pnpm run test:e2e

# PSP tests (need NetBird for webhooks):
PLAYWRIGHT_BASE_URL=https://<NETBIRD_URL> pnpm run test:e2e
```

> The Docker stack's Caddy reverse proxy listens on both localhost:3000 and the NetBird tunnel. Only PSP tests need the tunnel — login, admin, cash, and bill tests work against localhost.

## Docker Test Stack with Linked Local Packages

### Architecture

The Docker build supports overlaying local packages on top of npm-installed ones via BuildKit `additional_contexts`. This lets you develop the `@modular-api/fastify-checkout` (and other linked packages) locally and test them in the full Docker stack.

### How the Overlay Works

1. `docker-compose.test.yaml` defines `additional_contexts` whose paths are controlled by env vars (e.g., `LINKED_MODULAR_API_FASTIFY_CHECKOUT_PATH`)
2. When set, the Dockerfile's `COPY --from=linked-modular-api-fastify-checkout ./ /build/packages/modular-api-fastify-checkout/` copies the local package into the workspace
3. The Dockerfile injects a `link:` override into `pnpm-workspace.yaml` pointing to the local package directory
4. `pnpm install --no-frozen-lockfile` resolves the workspace, picking up the local copy via the `link:` override
5. `pnpm --filter ./packages/modular-api-fastify-checkout run build` builds the linked package inside Docker — no pre-building needed locally
6. The rest of the monorepo build (`pnpm run build`) uses the locally-built package via workspace resolution

### Full Workflow

**1. Set the linked package path**

```bash
export LINKED_MODULAR_API_FASTIFY_CHECKOUT_PATH=~/Projects/modular-api/packages/fastify-checkout
```

Any linked package context that is unset defaults to `.docker/empty` (an empty directory that contributes nothing to the build). The Dockerfile copies the entire package directory into the workspace and builds it internally via `pnpm --filter` — no pre-building needed locally.

**2. Clean Docker state and rebuild**

> **Important:** `SIMSUSTECH_NPM_TOKEN` must be `export`ed before any `docker compose` command, not just set:
> ```bash
> export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN)
> ```

```bash
docker compose -f docker-compose.test.yaml down --volumes
docker compose -f docker-compose.test.yaml build --no-cache api
```

`down --volumes` ensures a clean database. `build --no-cache` forces a fresh build with the latest package overlays (use `build` without `--build` on the up command per taste preference).

**3. Start the stack**

```bash
docker compose -f docker-compose.test.yaml up -d api
```

The API container runs migrations, seeds test data (`seed:test`), and starts the server. Healthcheck polls every 10s with a 15s start period and 10 retries.

**4. Verify the stack is healthy**

The Caddy reverse proxy sits in front of the API and exposes it on port 443 via NetBird tunnel and on port 3000 locally. Browse to `https://slimfact-dev.eu1.netbird.services` to verify.

```bash
cd packages/api
pnpm run test:e2e                        # cash/UI: localhost works
PLAYWRIGHT_BASE_URL=<NETBIRD_URL> pnpm run test:e2e  # PSP: needs webhook URL
```

Most tests run fine against localhost. Only Mollie/Stripe PSP tests need the NetBird tunnel for webhook callbacks.

### PSP-Specific Test Configs

To route iDEAL and credit card payments through a specific PSP, combine compose files:

```bash
# Route all online payments through Mollie
docker compose -f docker-compose.test.yaml -f docker-compose.test.mollie.yaml build --no-cache api
docker compose -f docker-compose.test.yaml -f docker-compose.test.mollie.yaml up -d api

# Route all online payments through Stripe
docker compose -f docker-compose.test.yaml -f docker-compose.test.stripe.yaml build --no-cache api
docker compose -f docker-compose.test.yaml -f docker-compose.test.stripe.yaml up -d api
```

The override files set `IDEAL_PAYMENT_HANDLER` and `CREDITCARD_PAYMENT_HANDLER` env vars which control the routing in `setup.ts`.

Run PSP-specific tests:

```bash
# Mollie tests (iDEAL + creditcard via Mollie)
cd packages/api && PLAYWRIGHT_BASE_URL=https://<NETBIRD_URL> npx playwright test tests/e2e/payments-mollie.spec.ts

# Stripe tests (iDEAL + creditcard via Stripe)
cd packages/api && PLAYWRIGHT_BASE_URL=https://<NETBIRD_URL> npx playwright test tests/e2e/payments-stripe.spec.ts
```

### Local Dev with pnpm link (No Docker)

For local development (vitrify dev server), use `pnpm link` to link modular-api packages:

```bash
cd ~/Projects/modular-api/packages/fastify-checkout && pnpm run build
cd ~/Projects/slimfact && pnpm link ~/Projects/modular-api/packages/fastify-checkout
pnpm install --no-frozen-lockfile
pnpm run dev
```

### Required Secrets

Secrets are mounted as Docker secrets from local files:

| Secret | File | Purpose |
|--------|------|---------|
| `SIMSUSTECH_NPM_TOKEN` | `env/SIMSUSTECH_NPM_TOKEN` | Private npm registry auth for `@modular-api/*` packages |
| `MOLLIE_API_KEY` | `env/MOLLIE_API_KEY` | Mollie API key (test mode) |
| `STRIPE_API_KEY` | `env/STRIPE_API_KEY` | Stripe API key (test mode) |

Unlike the old approach (Docker secrets mount to ~/.npmrc), the npm token is now passed as a build arg and written to ~/.npmrc directly in the Dockerfile.

### Build

```bash
pnpm run build  # Builds tools → app → api
```

### Docker Secrets

Secrets (API keys, tokens) must use Docker secrets, never env vars or hardcoded values in compose files:
1. Add to `secrets:` section with `environment:` source
2. Reference in service's `secrets:` list  
3. `@vitrify/tools/env` reads `/run/secrets/<NAME>` automatically — no command changes needed
4. Required secrets: `SIMSUSTECH_NPM_TOKEN`, `MOLLIE_API_KEY`, `STRIPE_API_KEY`

## Payment Flow

### Architecture

Payment handler code lives in `@modular-api/fastify-checkout` (external npm package). For development, the Docker build links a local copy via `linked-modular-api-fastify-checkout` additional context in `docker-compose.test.yaml` to test changes before publishing. Set `LINKED_MODULAR_API_FASTIFY_CHECKOUT_PATH` env var to your local path.

### Payment Handler Factory Pattern

Each PSP implements a factory function that returns a `FastifyCheckoutPaymentHandler`:

| Handler | Factory | Config |
|---------|---------|--------|
| Mollie | `createMolliePaymentHandler({ fastify, kysely, options })` | `apiKey` (required), `host` (required for webhook) |
| Stripe | `createStripePaymentHandler({ fastify, kysely, options })` | `apiKey` (required) |
| Cash | `createCashPaymentHandler(...)` | None (offline) |
| Bank transfer | `createBankTransferPaymentHandler(...)` | None (offline) |
| PIN | `createPinPaymentHandler(...)` | None (offline) |

Each handler provides: `createPayment`, `getPayment`, `getPayments`, `settlePayment`, `cancelPayment`, `refundPayment`, `getRefund`.

### Full Payment Lifecycle

```
[Admin] Creates invoice (CONCEPT)
  ↓ Send → status = OPEN
[Customer] Opens /invoice/{uuid}
  ↓ Clicks Pay → selects method
[invoiceHandler.addPaymentToInvoice()] routes to correct PSP handler
  ↓ createPayment() stores row in checkout.payments, returns checkoutUrl
[Customer] Redirected to PSP (mollie.com/checkout or checkout.stripe.com)
  ↓ Completes payment
[PSP] POST /{psp}/webhook → settlePayment() → updates payment row
  ↓ Checks amountPaid >= totalIncludingTax
[invoiceHandler] setInvoiceStatus({ status: PAID })
  ↓ Optionally
[invoiceHandler] fetchWebhookUrl() notifies external system
```

### Payment Method Routing

In `invoiceHandler.addPaymentToInvoice()`:

| Method | Default PSP | Env override |
|--------|------------|--------------|
| `ideal` | Mollie | `IDEAL_PAYMENT_HANDLER=mollie\|stripe` |
| `creditcard` | Stripe | `CREDITCARD_PAYMENT_HANDLER=mollie\|stripe` |
| `cash` | Cash (offline) | — |
| `bankTransfer` | Bank transfer (offline) | — |
| `pin` | PIN (offline) | — |

### Multi-Company Profiles

Both Mollie and Stripe use a profiles map with a `default` fallback:

```typescript
mollie: {
  profiles: {
    default: <handler>,
    [companyPrefix]: <handler>  // Company-specific API key
  }
}
```

Resolved via `(companyPrefix?) => handler` — returns company-specific profile if one exists, otherwise `default`.

### Webhook Handling

**Mollie** (`POST /mollie/webhook`):
- Receives `{ id: molliePaymentId }` from Mollie API
- Looks up payment in `checkout.payments` by `externalId`
- Calls `settlePayment()` to fetch/update payment status from Mollie
- If `amountPaid >= totalIncludingTax` and status is `OPEN` → sets invoice to `PAID`
- Calls `fetchWebhookUrl()` for external system notification

**Stripe** (`POST /stripe/webhook`):
- Receives full Stripe event, filters for `checkout.session.completed`
- Same settle + status flow as Mollie
- `webhookSecret` config accepted but verification not yet wired

### Refund Flow

1. `invoiceHandler.refundInvoice()` finds highest-paid PSP payment on the invoice
2. Calls `refundPayment()` on matching handler (Mollie or Stripe)
3. Handler creates refund via PSP API, stores in `checkout.refunds`
4. `getRefund()` syncs refund status from PSP on subsequent calls

### Test Mode Interactions

**Mollie**: After redirect to mollie.com/checkout → select a test bank → click Pay → on test status page select "Paid" → click Continue → wait for webhook (up to 15s) → verify invoice shows "paid"/"betaald"

**Stripe**: After redirect to checkout.stripe.com → fill email/name (card pre-filled for credit card, bank selection for iDEAL) → click Submit → authorize if prompted (iDEAL may show "Authorize Test Payment" button, credit card auto-completes) → wait for redirect back → wait for webhook (up to 60s) → verify invoice shows "paid"

**Test environment separation (strict)**:

| Environment | Command | Tests |
|---|---|---|
| **Local** (default routing) | `PLAYWRIGHT_BASE_URL=https://slimfact.localhost npx playwright test --grep-invert="payments-mollie\|payments-stripe" --workers=1` | All non-PSP: administrator, account, invoice-line-types, payments |
| **Mollie** (both PSP→Mollie) | `SLIMFACT_PSP=mollie API_HOST=<NETBIRD_URL> PLAYWRIGHT_BASE_URL=<NETBIRD_URL> npx playwright test payments-mollie.spec.ts --workers=1` | Mollie PSP only: iDEAL, Creditcard |
| **Stripe** (both PSP→Stripe) | `SLIMFACT_PSP=stripe API_HOST=<NETBIRD_URL> PLAYWRIGHT_BASE_URL=<NETBIRD_URL> npx playwright test payments-stripe.spec.ts --workers=1` | Stripe PSP only: iDEAL, Creditcard, Refunds |

**Never mix**: PSP tests need `API_HOST` set to NetBird URL (for OIDC issuer match). Non-PSP tests use `slimfact.localhost`. Use `--workers=1` to avoid parallel DB conflicts.

### Test patterns

**Combobox (Quasar QSelect)**: Never use `expect(locator).toBeVisible()` on a listbox after clicking a combobox — the Quasar QSelect popup can be unreliable. Use the `fillComboboxes()` helper from `helpers.ts` which clicks the combobox, presses ArrowDown as fallback, and waits for `[role="listbox"] [role="option"]` with 15s timeout.

**mkInvoice / mkBill**: After submitting an invoice/bill form, navigate to `/admin/invoices` and `waitForLoadState('networkidle')` before clicking `.q-expansion-item__toggle-icon'.first()` — otherwise parallel tests' invoices pollute the list and `.first()` selects the wrong item.

**Cash payments**: Cash is an admin-side (POS) payment method, NOT available on the public invoice page. Tests must go through `/admin/invoices` → expand invoice → More → "Add payment" → Cash.

**Stripe `completeStripePayment`**: The `#authorize-test-payment` button only appears for iDEAL flow. Use short timeout (5s) on its click attempt, not 60s. For credit card payments, Stripe auto-redirects after submit — no confirm button needed.

**Shared page state**: Tests sharing a `page` variable (serial mode) must be careful about leftover state from prior tests. Prefer `browser.newPage()` + `login()` for each test that creates/modifies data.
Run with: `cd packages/api && npx playwright test tests/e2e/payments.spec.ts`

### Docker Test Configs

| File | Purpose |
|------|---------|
| `docker-compose.test.yaml` | Base test setup with DB, MailHog, NetBird |
| `docker-compose.test.mollie.yaml` | Overrides: routes iDEAL+creditcard → Mollie |
| `docker-compose.test.stripe.yaml` | Overrides: routes iDEAL+creditcard → Stripe |

Usage: `docker compose -f docker-compose.test.yaml -f docker-compose.test.mollie.yaml up -d api` (build separately with `build --no-cache` first)

### Quality Checks (run after every change)

> **Note:** `PI_RTK_BYPASS=1` must be set when running `pnpm run build` inside a Pi session to bypass RTK output compression that hides TypeScript errors. `SIMSUSTECH_NPM_TOKEN` must be `export`ed (not just set) before any Docker command.

```bash
pnpm run lint
pnpm run format:check || pnpm run format:write
pnpm run build
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN) && docker compose -f docker-compose.test.yaml down --volumes
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN) && docker compose -f docker-compose.test.yaml build --no-cache api
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN) && docker compose -f docker-compose.test.yaml up -d api
cd packages/api && pnpm run test:e2e
# PSP tests need: PLAYWRIGHT_BASE_URL=<NETBIRD_URL> pnpm run test:e2e
```

### Database

- Migrations: `packages/api/src/kysely/migrations/`
- Seeds: `packages/api/src/kysely/seeds/`
- Types: Generated from DB schema in `types.ts`

### E2E Testing

- **Login flow**: Use the pattern from `administrator.spec.ts` — navigate, click Login, `waitForLoadState('networkidle')`, expect URL, fill form, click submit, wait for user URL.
- **Debug helper**: `tets/e2e/helpers.ts` exports `dumpPage(page, label)` which logs URL, buttons, inputs, and body text — useful for probing pages during test development.
- **Service workers**: Blocked in `playwright.config.ts` (`serviceWorkers: 'block'`) to prevent hydration warnings.
- **Base URL**: Set via `PLAYWRIGHT_BASE_URL` env var. Defaults to `https://localhost:3000`. Only PSP payment tests (Mollie/Stripe) need the NetBird URL for webhook callbacks.
- **PSP overrides**: Use `-f docker-compose.test.mollie.yaml` or `-f docker-compose.test.stripe.yaml` to route payment methods through a specific PSP.
