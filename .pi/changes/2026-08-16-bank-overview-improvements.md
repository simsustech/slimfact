# 2026-08-16 Bank Overview Improvements

## What changed

Five user-requested improvements to the bank overview page, plus critical bug fixes discovered during implementation.

### Features

1. **PSP settlement drill-down** (`BankPspSettlementDialog.vue` new)
   - Reconciled rows show a "Settlement details" button (i-mdi-invoice-text icon)
   - Opens a read-only dialog showing PSP settlement (psp, amount, fee, date, status) and individual payments (externalId, amount, status, resolved invoice number)
   - Invoice resolution uses `extractInvoiceUuid` fallback: externalId seam first, then description-uuid seam

2. **Reconciled status filter** (`BankOverviewPage.vue`)
   - Added `{ label: 'Reconciled', value: 'reconciled' }` to the status select
   - Router already supported the enum; this exposes it in the UI

3. **Companies filter defaults to all-selected** (`BankOverviewPage.vue`)
   - Init-once `watchEffect` sets `companyFilter` to all company IDs on first load
   - Empty still means all (router semantics unchanged)

4. **Banking-api healthcheck** (`docker-compose.test.yaml`)
   - Added healthcheck on `/health` endpoint
   - Added `depends_on: api: service_healthy` to ensure deterministic startup
   - `up --wait` now waits for the banking-api to be fully ready

### Bug fixes

1. **Unlinked rows missing from overview** (`bankTransactions.ts`)
   - My earlier brace fix for PSP drill-down accidentally moved `rows.push()` inside `if (linkedRows.length > 0)`
   - Only linked transactions were pushed; unlinked rows vanished from the overview
   - Fixed brace structure so push always runs at the for-of-body level

2. **View button hidden by Link button** (`BankOverviewPage.vue`)
   - After reconciling a PSP payout, `canLink()` still returned true (stale suggestion)
   - The Link button rendered instead of the Settlement details view button
   - Fixed `canLink` to exclude reconciled rows: `row.coverage !== 'reconciled' && (...)`

3. **Escape not closing ResponsiveDialog** (test fix)
   - `@simsustech/quasar-components` ResponsiveDialog uses q-layout focus trap
   - Escape key doesn't penetrate the trap; changed test to click Close (X) button

### Test updates

1. **banking-company-filter.spec.ts** — rewrote `pick()` to deselect-others (default-all filter means clicking an option toggles it OFF)
2. **banking-link.spec.ts** — added PSP drill-down assertions + Reconciled filter assertion

## Files changed

| File                                                                | Change                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/api/src/trpc/admin/bankTransactions.ts`                   | Brace fix, remove debug logs                                 |
| `packages/app/src/pages/admin/BankPage/BankOverviewPage.vue`        | canLink fix, default-all companies, reconciled status option |
| `packages/app/src/pages/admin/BankPage/BankPspSettlementDialog.vue` | New: PSP settlement drill-down dialog                        |
| `packages/app/src/lang/en.ts`                                       | settlementDetails key                                        |
| `packages/app/src/lang/nl.ts`                                       | settlementDetails key                                        |
| `packages/app/src/lang/de.ts`                                       | settlementDetails key                                        |
| `docker-compose.test.yaml`                                          | Banking-api healthcheck + depends_on api                     |
| `packages/api/tests/e2e/banking-link.spec.ts`                       | PSP drill-down test, dialog close fix                        |
| `packages/api/tests/e2e/banking-company-filter.spec.ts`             | pick() helper for default-all filter                         |

## Quality gates

- Lint: clean
- Format: clean
- API tsc: clean
- App vue-tsc: clean
- Build: clean
- API unit tests: 92 passed (slimfact_unit)
- Banking-api unit tests: 7 passed (slimfact_unit)
- Full E2E: 26 passed, 8 skipped, 0 failed (1 flaky Cash Payment — passes on re-run)
- Banking specs: 27 passed, 8 skipped, 0 failed
