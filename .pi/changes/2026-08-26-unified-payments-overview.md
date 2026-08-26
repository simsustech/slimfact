# 2026-08-26 — Unified Payments Overview (/admin/payments)

Implements `.pi/plans/2026-08-25-unified-payments-overview.md` — result=success
(evaluation sibling written). Backups before start:
`backup/2026-08-25-payment-dates` in both slimfact worktree and modular-api.

## What changed

### Backend (packages/api)

- `src/trpc/admin/payments.ts` (NEW): `adminPaymentsRoutes` with `listPayments`
  (Kysely unionAll of payments+refunds, wrapper filters q/date/methods/
  statuses/psps, aggregates via CASE-sums, 366-day window cap) and
  `exportPayments` (month-default window, MAX_ROWS=10k cap, truncated flag).
  Banking-enabled runs use a route-layer merge with proxy credits
  (`fetchUnmatchedCredits`), filters re-applied to bank rows in JS.
- `src/banking/ledger.ts` (NEW): proxy CRDT→LedgerRow mapping; excludes
  linked txids (`bank:<txid>` anti-join) and read-time-recognized PSP payouts
  (`matchSettlementForCredit`); carries account/company attribution for the
  reused Link dialog.
- Mounted in `src/trpc/admin/index.ts`.

### Frontend (packages/app)

- `queries/admin/payments.ts` (NEW): list/export hooks +
  `usePaymentsUrlState()` (URL⇄filters, comma arrays, 300 ms debounce).
- `pages/admin/PaymentsPage/PaymentsPage.vue` (NEW): aggregates cards
  (In/Refunded/Net/Count/Unallocated), filter bar, ledger QTable with
  via-bank-sync badge, needs-review badge, invoice links, offline delete
  (existing rules/dialog), CSV export (BOM, `;`, deferred revoke).
- Router: `/admin/payments`; Bank settings relocated to
  `/admin/settings/banking`; `/admin/bank/settings` now redirects;
  `/admin/bank/overview` kept URL-reachable (transition, drawerless).
- Navigation sweep (nav-sync): Payments drawer item under Invoices; Bank
  expansion group removed from drawer; Bank item inside Administrator →
  Settings (drawer + settings hub menu list); DashboardAdminMenuList swaps
  its Bank entry for Payments (`PAYMENTS_ICON` added to configuration.ts);
  DashboardBankMenuList + BankOverviewPage banner now point directly at
  `/admin/settings/banking` (transition hub `/admin/bank` kept until
  overview removal is accepted).
- i18n ×3: `payment.overview.*` (+ deletePayment key).
- Runtime-import hygiene: fastify-checkout enums are type-only in app code
  (PWA vendor size cap).

### Seeds & tests

- `kysely/seeds/test.ts`: refund `re-seed-001` on E's Mollie payout; failed
  iDEAL + pending creditcard attempts on open F; deterministic uuid pins.
- NEW unit spec `tests/unit/payments-overview.spec.ts` (7 tests, DB-backed,
  token-scoped against parallel-suite leakage).
- E2E `tests/e2e/payments-overview.spec.ts` (7 tests): row kinds incl.
  bank-review via credit-010 (stable under Sync-now), aggregates (refund
  €10.00 exact), deep-link/reload filter persistence, Link dialog reuse,
  invoice drill-down, CSV download content.
- Legacy `banking-link.spec.ts`: two drawer assertions updated to the new
  structure (transition); all other legacy specs untouched and green.

## Why

Single money-ledger surface consolidating the bank review queue
(payment-first dedup), per interview decisions; Bank settings moved under
Administrator → Settings as requested.

## Gates

Full fresh-stack Playwright 40 passed / 0 failed / 8 skipped; units 171/171
(slimfact_unit); build/lint/format clean. Tree intentionally uncommitted.

## Gotchas for next session

- Every `down --volumes` wipes slimfact_unit → re-migrate api AND banking-api.
- fastify-checkout local dist overlay in `.pnpm/...fastify-checkout@0.9.1.../dist`
  must be re-synced after any `pnpm i` (or promote to a link: override).
- seed-credit-010 ("FACTUUR 2026-0008", partial underpay) is the only credit
  that never auto-applies — use it for unmatched-row assertions.
- ast-grep rule `no-sql-in-code-js` false-positives on tRPC `.query()` bodies
  containing "select" — verify via eslint/tsc/vitest instead.
