# 2026-08-04 Dashboard: complete revenue axis, click-to-zoom, formatPrice in tools

## Summary

Made the revenue chart show the WHOLE selected period (zero-filled complete axis with
day/week/month/quarter bins), made presets cover the full calendar period, added
click-to-zoom on chart buckets, fixed the action-items aggregation bug, moved
DashboardPage to `src/pages` with `<q-page>`, and consolidated the duplicated price
formatters into `@slimfact/tools`.

## Changes

### Complete axis + granularity (backend)

- `packages/fastify-checkout/src/invoiceHandler.ts` — `getPaidRevenue` now generates the
  FULL bucket series via Postgres `generate_series` (day/week/month/quarter), returns
  `{ labels, buckets: { start }[], series }` with zero-filled data; week labels are ISO
  week numbers (`2026-W32`), quarter labels `2026-Q3`. Series are seeded from the
  requested statuses so zero-revenue types still get a dataset. `bucket_date` result
  column is camelCased by Kysely's CamelCasePlugin (`bucketDate`).
- `packages/api/src/trpc/admin/dashboard.ts` — `pickGranularity` thresholds changed to
  day ≤10d, week ≤45d, month ≤200d, quarter beyond; new `bucketEndDate()` maps each
  bucket start to an inclusive `{ start, end }` range; `getDashboardStats` returns
  `buckets` with end dates so the app can zoom into a clicked bucket.
- `packages/api/tests/unit/dashboard-trpc.test.ts` — updated granularity thresholds;
  added `bucketEndDate` tests (leap year, month ends, quarter ends, week across year).

### Full-period presets + click-to-zoom (app)

- `packages/app/src/components/dashboard/dateRange.ts` — `presetDateRange` now covers the
  whole calendar period (week = Mon..Sun, month = 1st..last, quarter = 1st..last, year =
  Jan 1..Dec 31) so the axis always shows the full period; `now` injectable for tests.
- `packages/app/src/pages/admin/DashboardPage.vue` — moved from
  `components/dashboard/` to `pages/admin/` (router updated), template wrapped in
  `<q-page padding>`; chart gets `:buckets` + `@select` handler that sets the dashboard
  range to the clicked bucket (zoom); `actionItems` now uses the extracted
  `aggregateActionItems()` module.
- `packages/app/src/components/dashboard/DashboardRevenueChart.vue` — `buckets` prop,
  `select` emit via chart.js `onClick` with `interaction: { mode: 'index', intersect:
  false }` (whole category clickable), pointer cursor on hover, `data-chart-labels`
  attribute for E2E assertions; tooltip/y-axis use `formatPrice` from tools.
- `packages/app/src/components/dashboard/actionItems.ts` (new) — multi-company
  aggregation for OPEN + overdue buckets (fixes `.find()`/assignment bugs that dropped
  all but the first company's row); `tests/unit/actionItems.test.ts` (new).
- `packages/app/src/components/dashboard/recentActivity.ts` (new) — extracted
  filter/pagination/icon/color logic from DashboardRecentActivity;
  `tests/unit/recentActivity.test.ts` (new).
- `packages/app/src/components/dashboard/revenueSeries.ts` (new) — series lookup/sum/
  chart-dataset building; `tests/unit/revenueSeries.test.ts` (new).
- Lang: `bin.quarter` added to en-US/de/nl; removed dead `chart.currency` key.

### Shared price formatting in @slimfact/tools

- `packages/tools/src/index.ts` (new main entry) — `formatPrice({ value, locale,
  currency = 'EUR', includeSymbol })`; amounts in cents; locale-aware; symbol optional.
- `packages/tools/src/digiboox/index.ts` — local `formatPrice` removed, imports from
  `../index.js` (output unchanged).
- `packages/api/src/trpc/admin/invoices.ts` — local `formatPrice` removed, imports from
  `@slimfact/tools` with `includeSymbol: true` (email output unchanged).
- `packages/app/src/components/dashboard/formatCurrency.ts` deleted; chart + tooltip use
  `formatPrice({ ..., locale, includeSymbol: true })`; `tests/unit/formatPrice.test.ts`
  covers locale/decimal/thousands/symbol/custom-currency.
- Note: pnpm `inject-workspace-packages=true` snapshots `@slimfact/tools` into the .pnpm
  store at install time — locally the app/api symlinks were re-pointed at the live
  workspace dir (never stale).

## E2E

- `dashboard.spec.ts` — binning caption (week for month, quarter for year), complete
  axis (7 days for a week, 4 quarters for a year), click-a-quarter-bar zooms to
  `01-01 → 03-31` and re-bins to month; empty-state made deterministic (deselects
  companies via chip Remove buttons); year preset end = Dec 31. 20/20 pass.

## Fixed bugs

- Action items "Open invoices" only summed the FIRST company's row (`.find()`); overdue
  buckets overwrote multi-company rows — both fixed via `aggregateActionItems`.
- Postgres `'1 quarter'` interval is invalid → step quarters as `'3 months'`.
- Kysely raw `sql().execute()` returns a QueryResult (`.rows`), not an array.
- Kysely CamelCasePlugin renames raw result columns (`bucket_date` → `bucketDate`).
