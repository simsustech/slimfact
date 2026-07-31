---
path: .pi/plans/dashboard.md
created: "2026-07-19"
committed-for-implement: true
---

# Dashboard Implementation Plan

## Overview

Replace the current `/admin` landing page with a real dashboard. The existing `DashboardAdminMenuList.vue` stays as a card inside the dashboard.

## Design Decisions

- **Revenue attribution**: invoices use `i.date`, bills use `p.paid_at` (no invoice date on bills)
- **Action items**: invoices only (bills/receipts are non-actionable in SlimFact)
- **Status donut**: one chart covering all 7 statuses (CONCEPT, OPEN, PAID, OVERDUE, CANCELED, BILL, RECEIPT). OVERDUE = OPEN + due_date < NOW()
- **Aging buckets**: based on `reminderSentDates.length` — 0=needsReminder, 1=reminder1, 2=reminder2, ≥3=exhortation
- **Date range**: calendar-month presets (Today/Week/Month/Qtr/Year) + custom picker, mutually exclusive
- **Company scope**: QSelect multi-select, default all, hidden when single company
- **Activity**: QTimeline with QSelect filter, events from 5 sources merged in JS
- **Charts**: vue-chartjs Bar (revenue) + Doughnut (status)

## New Dependencies

```
vue-chartjs + chart.js
```

## Change Order

---

### Step 0: E2E test spec

**(a) New file**: `packages/api/tests/e2e/dashboard.spec.ts`

**(b) Diff**: Create file with 10 test cases, all `test.skip`. Follows existing pattern: `test.beforeAll` logs in, `test.describe.configure({ mode: 'serial' })`, tests navigate to `/admin`.

**(f) Tactic**: Same structure as `administrator.spec.ts`. Login via admin credentials. Each test uses `page.goto('/admin')` and asserts against dashboard sections.

**(g) Test layer**: E2E — `packages/api/tests/e2e/dashboard.spec.ts`

**Test cases (all start skipped):**

1. `dashboard-renders-sections` — all section cards visible
2. `company-filter` — select/deselect companies, stats update
3. `revenue-cards-period-preset` — click preset, verify amounts
4. `revenue-cards-custom-range` — pick custom dates, verify update
5. `status-chart-renders` — donut visible with segments
6. `action-items-open-navigation` — click Open, verify navigates to /admin/invoices filtered
7. `action-items-overdue-navigation` — click Needs Reminder, verify navigation
8. `recent-activity-renders` — timeline entries visible
9. `recent-activity-filter` — select filter, entries filtered
10. `empty-state` — no data shows empty state messages

**(d1) New test**: This IS the test file. All skipped → all pass (gate is green with zero active tests).

**(d2) Cumulative regression**: `cd packages/api && npx playwright test --config=playwright.nosetup.config.ts`

---

### Step 1: Zod schemas

**(a) New file**: `packages/api/src/zod/dashboard.ts`

**(b) Diff**: Create file with `getDashboardStatsInput`, `getDashboardActivityInput`, `eventTypeEnum`. `dateSchema` validates YYYY-MM-DD. `getDashboardStatsInput` refines `dateFrom ≤ dateTo`.

**(f) Tactic**: `dateSchema` via `z.string().regex()`. Refinement via `.refine()`. `eventTypeEnum` via `z.enum()`. `limit` via `.optional().default(20).pipe(z.number().int().min(1).max(50))`.

**(g) Test layer**: unit (`vitest`)

**(d1) New test**: `zod/dashboard.test.ts` — valid input, invalid date, dateFrom>dateTo, missing optionals, limit bounds.

**(d2) Cumulative regression**: `pnpm --filter @slimfact/api exec vitest run tests/unit`

---

### Step 2: fastify-checkout methods

**(a) Repo**: `~/Projects/modular-api/packages/fastify-checkout` — modify `src/invoiceHandler.ts`

**(b) Diff**: Add 5 methods to `invoiceHandler`:

| #   | Method                                                        | Returns                                                           |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `getInvoiceStatusCounts(companyIds?)`                         | `{ companyId, companyName, status, count, totalAmount }[]`        |
| 2   | `getInvoiceOverdueAging(companyIds?)`                         | `{ companyId, companyName, reminderCount, count, totalAmount }[]` |
| 3   | `getPaidRevenue({ statuses, companyIds?, dateFrom, dateTo })` | `number`                                                          |
| 4   | `getOutstandingTotal({ statuses, companyIds? })`              | `number`                                                          |
| 5   | `getActivityFeed({ companyIds?, eventTypes?, limit? })`       | `{ type, documentUuid, clientName, amount, timestamp }[]`         |

**(f) Tactic**: All Kysely chainable — `.selectFrom()`, `.where()`, `.groupBy()`, `.fn.sum()`, `.fn.countAll()`, `eb.case()` for computed overdue status. Overdue aging uses `eb.fn('jsonb_array_length', ['reminderSentDates'])` with `LEAST(..., 3)`. `getPaidRevenue` always `SUM(p.amount) FROM payments JOIN invoices`. `getActivityFeed` runs 5 queries, merges with `Array.sort()` by timestamp DESC, `.slice(0, limit)`. Zero `sql` template literals.

**(g) Test layer**: unit (`vitest` from fastify-checkout package)

**(d1) New test**: `invoiceHandler.test.ts` — each method tested against known seed data.

**(d2) Cumulative regression**: `pnpm --filter @modular-api/fastify-checkout run test`

---

### Step 3: tRPC routes

**(a) New file**: `packages/api/src/trpc/admin/dashboard.ts`. Modify `packages/api/src/trpc/admin/index.ts`.

**(b) Diff**: Two routes: `getDashboardStats` and `getDashboardActivity`. Register in `admin/index.ts`.

**(f) Tactic**:

- `getDashboardStats`: `Promise.all` with 4 fastify-checkout calls. Maps `reminderCount` → label via `['needsReminder','reminder1','reminder2','exhortation'][Math.min(count,3)]`. Preset date ranges via `date-fns` (`startOfDay/Week/Month/Quarter/Year`).
- `getDashboardActivity`: delegates to `getActivityFeed`.

**(g) Test layer**: unit (`vitest`)

**(d1) New test**: `dashboard.test.ts` — test shape, aging labels, date boundaries, eventType filtering.

**(d2) Cumulative regression**: `pnpm --filter @slimfact/api exec vitest run tests/unit`

---

### Step 4: Frontend i18n keys

**(a) Files**: `lang/en-US.ts`, `lang/nl.ts`, `lang/de.ts`, `lang/index.ts` (modify)

**(b) Diff**: Add `dashboard.admin.*` keys (36 keys, enumerated in ## i18n Keys section). Add type to `Language`.

**(f) Tactic**: Config-only — no tactic. Verified by `tsc`.

**(g) Test layer**: none — verified by build

**(d1) New test**: No test — verified by `tsc` compilation.

**(d2) Cumulative regression**: `PI_RTK_BYPASS=1 pnpm --filter @slimfact/app run build`

---

### Step 5: Frontend data queries

**(a) New file**: `packages/app/src/queries/admin/dashboard.ts`

**(b) Diff**: Two Pinia Colada `defineQuery` functions.

**(f) Tactic**: Follow `useAdminGetInvoicesQuery` pattern. Reactive refs: `companyIds`, `dateFrom`/`dateTo`, `eventTypes`, `limit`. `useQuery` with `enabled: !import.meta.env.SSR`.

**(g) Test layer**: none — thin tRPC wrappers, covered by E2E in step 11

**(d1) New test**: No unit test. No E2E test unskipped yet.

**(d2) Cumulative regression**: `PI_RTK_BYPASS=1 pnpm --filter @slimfact/app run build`

---

### Step 6: DashboardRevenueCards.vue

**(a) New file**: `packages/app/src/components/dashboard/DashboardRevenueCards.vue`

**(b) Diff**: Display component. Props: `{ revenueInvoices: number, revenueBills: number, dateLabel: string }`. Renders two QCard.

**(f) Tactic**: Pure display. `<Price :value="revenueInvoices" />`. `dateLabel` as subtitle. No internal state.

**(g) Test layer**: E2E — `dashboard.spec.ts`: `dashboard-renders-sections`

**(d1) New test**: **Unskip `dashboard-renders-sections`** (test 1). Confirm it fails (no dashboard renders). Implement component (via step 11 parent wiring later — for now, render in isolation). Confirm it passes.

**(d2) Cumulative regression**: `cd packages/api && npx playwright test --config=playwright.nosetup.config.ts`

---

### Step 7: DashboardRevenueChart.vue

**(a) New file**: `packages/app/src/components/dashboard/DashboardRevenueChart.vue`

**(b) Diff**: Display component. Props: `{ labels: string[], datasets: { label, data, backgroundColor }[] }`.

**(f) Tactic**: Pure display. Wraps vue-chartjs `<Bar>`. No data logic.

**(g) Test layer**: E2E — `dashboard.spec.ts` (rendering verified in step 11)

**(d1) New test**: No E2E test unskipped — chart rendering verified in step 11.

**(d2) Cumulative regression**: `cd packages/api && npx playwright test --config=playwright.nosetup.config.ts`

---

### Step 8: DashboardStatusChart.vue

**(a) New file**: `packages/app/src/components/dashboard/DashboardStatusChart.vue`

**(b) Diff**: Display component. Props: `{ labels: string[], counts: number[], totalAmounts: number[] }`.

**(f) Tactic**: Pure display. Wraps vue-chartjs `<Doughnut>`. Fixed colors per status. Tooltip shows count + total.

**(g) Test layer**: E2E — `dashboard.spec.ts`: `status-chart-renders`

**(d1) New test**: **Unskip `status-chart-renders`** (test 5). Confirm fails → implement → confirm passes.

**(d2) Cumulative regression**: `cd packages/api && npx playwright test --config=playwright.nosetup.config.ts`

---

### Step 9: DashboardActionItems.vue

**(a) New file**: `packages/app/src/components/dashboard/DashboardActionItems.vue`

**(b) Diff**: Display component. Props: `{ open: {count, totalAmount}, overdue: { needsReminder: {...}, reminder1: {...}, reminder2: {...}, exhortation: {...} } }`. 5 clickable QItems. Emits `navigate(type, uuid?)`.

**(f) Tactic**: Computed list from props. Each QItem: icon, i18n label, count+amount badge via `<Price>`. Click emits. Parent routes. Aging label: static map `reminderCount` → label.

**(g) Test layer**: E2E — `dashboard.spec.ts`: `action-items-open-navigation`, `action-items-overdue-navigation`

**(d1) New test**: **Unskip `action-items-open-navigation`** (test 6) and **`action-items-overdue-navigation`** (test 7). Confirm fail → implement → confirm pass.

**(d2) Cumulative regression**: `cd packages/api && npx playwright test --config=playwright.nosetup.config.ts`

---

### Step 10: DashboardRecentActivity.vue

**(a) New file**: `packages/app/src/components/dashboard/DashboardRecentActivity.vue`

**(b) Diff**: Display component. Props: `{ entries: ActivityEntry[] }`. QTimeline with QSelect filter.

**(f) Tactic**: Computed `filteredEntries` from `selectedEventType` ref (default 'all'). QTimeline with `v-for`. Each entry: color-coded icon, client name + relative time via `formatDistanceToNow`, amount via `<Price>`. Client-side filter.

**(g) Test layer**: E2E — `dashboard.spec.ts`: `recent-activity-renders`, `recent-activity-filter`

**(d1) New test**: **Unskip `recent-activity-renders`** (test 8) and **`recent-activity-filter`** (test 9). Confirm fail → implement → confirm pass.

**(d2) Cumulative regression**: `cd packages/api && npx playwright test --config=playwright.nosetup.config.ts`

---

### Step 11: DashboardPage.vue

**(a) New file**: `packages/app/src/components/dashboard/DashboardPage.vue`

**(b) Diff**: Parent orchestrator. Reactive state, fetches, composes all child components + `DashboardAdminMenuList`. Grid layout with per-section loading/error/empty states. Hidden QSelect when 1 company.

**(f) Tactic**: **State**: `selectedCompanyIds`, `dateRange` (preset or custom), `eventTypeFilter`. **Fetching**: `useDashboardStats` + `useDashboardActivity` from step 5. **Date range**: QBtnToggle presets + QDate inputs, mutually exclusive. **Company filter**: `<q-select multiple>`, hidden when ≤1 company. **Data slicing**: computed props fed to child components. **Layout**: QPage padding, `<div class="row q-col-gutter-md">`, each section in `<q-card>`. **States**: `<q-skeleton>` loading, error + retry `<q-btn>`, "No data" empty.

**(g) Test layer**: E2E — `dashboard.spec.ts`: `company-filter`, `revenue-cards-period-preset`, `revenue-cards-custom-range`, `empty-state`

**(d1) New test**: **Unskip `company-filter`** (test 2), **`revenue-cards-period-preset`** (test 3), **`revenue-cards-custom-range`** (test 4), **`empty-state`** (test 10). All 10 tests active. Confirm remaining fail → implement parent → confirm all 10 pass.

**(d2) Cumulative regression**: `cd packages/api && npx playwright test --config=playwright.nosetup.config.ts`

---

### Step 12: AdminPage.vue

**(a) File**: `packages/app/src/pages/AdminPage.vue` (modify)

**(b) Diff**: Replace `<DashboardAdminMenuList />` with `<DashboardPage />`.

**(f) Tactic**: One-line template change. `<q-page padding><DashboardPage /></q-page>`.

**(g) Test layer**: E2E — covered by step 11 tests (all navigate to `/admin`)

**(d1) New test**: Covered by existing tests from step 11.

**(d2) Cumulative regression**: `cd packages/api && npx playwright test --config=playwright.nosetup.config.ts`

---

### Step 13: Quality checks

**(f) Tactic**:

```bash
pnpm run lint
pnpm run format:check
PI_RTK_BYPASS=1 pnpm run build
cd packages/api && pnpm run test:e2e
```

**(d2) Cumulative regression**: This IS the full regression gate — `pnpm run test:e2e` with default config (includes globalSetup docker rebuild).

---

### Step 14: Documentation

**(f) Tactic**: `cd packages/api && pnpm exec playwright test tests/e2e/screenshots-admin.spec.ts --project=chromium`. Recap: `.pi/changes/YYYY-MM-DD-dashboard.md`.

## Edge Cases

| Case                       | Handling                                       |
| -------------------------- | ---------------------------------------------- |
| No data at all             | Per-section empty state messages               |
| Single company             | QSelect hidden                                 |
| All companies deselected   | "Select a company to view stats" prompt        |
| Loading state              | Per-section skeleton/spinner                   |
| Error state                | Per-section error + retry button               |
| Zero revenue in period     | Cards show €0.00, chart shows zero-height bars |
| Custom date range ↔ preset | Mutually exclusive                             |
| Overdue with no due_date   | Treated as not overdue                         |
| Many companies in chart    | Legend capped at 5 + "Other"                   |
| Reminder array 4+ entries  | Bucketed as exhortation (≥3)                   |
| Concurrent admin users     | No polling; refetch on mount + filter change   |
| No `paid_at` on payment    | Excluded from bill revenue + activity          |

## i18n Keys

```
dashboard.admin.title
dashboard.admin.companyFilter.label / .allSelected / .noneSelected
dashboard.admin.revenue.title / .today / .week / .month / .quarter / .year / .customRange / .invoices / .bills / .chart.title
dashboard.admin.statusChart.title
dashboard.admin.statusChart.status.concept / .open / .paid / .overdue / .canceled / .bill / .receipt
dashboard.admin.actionItems.title / .open
dashboard.admin.actionItems.overdue.needsReminder / .reminder1 / .reminder2 / .exhortation
dashboard.admin.recentActivity.title
dashboard.admin.recentActivity.filter.all / .invoiceOpened / .billCreated / .payment / .reminder / .exhortation
dashboard.admin.empty.noData / .noCompanySelected
```

## New Files

| File                                                                | Purpose                  |
| ------------------------------------------------------------------- | ------------------------ |
| `packages/api/src/zod/dashboard.ts`                                 | Zod schemas              |
| `packages/api/src/trpc/admin/dashboard.ts`                          | tRPC routes              |
| `packages/app/src/queries/admin/dashboard.ts`                       | Pinia Colada queries     |
| `packages/app/src/components/dashboard/DashboardPage.vue`           | Parent orchestrator      |
| `packages/app/src/components/dashboard/DashboardRevenueCards.vue`   | Revenue cards            |
| `packages/app/src/components/dashboard/DashboardRevenueChart.vue`   | Bar chart                |
| `packages/app/src/components/dashboard/DashboardStatusChart.vue`    | Doughnut chart           |
| `packages/app/src/components/dashboard/DashboardActionItems.vue`    | Action items             |
| `packages/app/src/components/dashboard/DashboardRecentActivity.vue` | Activity timeline        |
| `packages/api/tests/e2e/dashboard.spec.ts`                          | E2E test spec (10 tests) |

## Modified Files

| File                                   | Change                                   |
| -------------------------------------- | ---------------------------------------- |
| `packages/api/src/trpc/admin/index.ts` | Register dashboard routes                |
| `packages/app/src/lang/en-US.ts`       | i18n keys                                |
| `packages/app/src/lang/nl.ts`          | i18n keys                                |
| `packages/app/src/lang/de.ts`          | i18n keys                                |
| `packages/app/src/lang/index.ts`       | Type definition                          |
| `packages/app/src/pages/AdminPage.vue` | Replace content with `<DashboardPage />` |

<!-- /plan revision marker -->
