# 2026-08-04 Dashboard: revenue line chart, DATE_FORMAT env, realistic seed

## Summary

Made the admin dashboard revenue section a real time-series line chart (invoices/bills/receipts lines, €-formatted Y axis), moved the date format into a server-side env-config value exposed via `/configuration`, and made the fake seed produce realistic, month-spread revenue data. Also fixed `pnpm deploy` losing the `link:` overrides (force-legacy-deploy).

## Changes (slimfact worktree)

### Revenue chart

- `packages/app/src/components/dashboard/DashboardRevenueChart.vue` — rewritten from bar chart to `vue-chartjs` `Line` chart: time on X, revenue (€/$) on Y with currency tick formatter, one line per invoice type, `noData` empty state, auto day/week/month bucketing.
- `packages/app/src/components/dashboard/DashboardPage.vue` — removed the nav list (`DashboardAdminMenuList`) from the dashboard page; wired `paidRevenueSeries` (labels + 3 datasets) into the chart; split revenue into `revenueInvoices` / `revenueBills` / `revenueReceipts`; DateInputs use `DATE_FORMAT`.
- `packages/app/src/components/dashboard/DashboardRevenueCards.vue` — 3 cards (Invoices, Bills, Receipts).

### DATE_FORMAT via env

- `packages/api/src/config/env.ts` — `dateFormat: read('DATE_FORMAT') || 'DD-MM-YYYY'`.
- `packages/api/src/setup.ts` — `/configuration` endpoint exposes `DATE_FORMAT: config.dateFormat`.
- `packages/app/src/configuration.ts` — `DATE_FORMAT: string` on the client-config interface + `import.meta.env.VITE_DATE_FORMAT || 'DD-MM-YYYY'` default.
- `DashboardPage.vue`, `SubscriptionForm.vue`, `ExportsPage.vue` — `format="DD-MM-YYYY"` → `:format="DATE_FORMAT"`.
- Reverted the earlier `@slimfact/tools/constants` subexport (superseded by env-based config).

### Backend (fastify-checkout)

- `packages/fastify-checkout/src/index.ts` + `invoiceHandler.ts` — `getPaidRevenue` now returns `{ labels, series: { status, data[] }[] }` with a `granularity: 'day' | 'week' | 'month'` input; groups payments by time bucket + invoice status.
- `packages/api/src/trpc/admin/dashboard.ts` — `pickGranularity()` (day ≤31d, week ≤84d, month beyond); requests PAID+BILL+RECEIPT series; returns `paidRevenueSeries`.

### Seed (realistic revenue)

- `packages/api/src/kysely/seeds/fake.ts` — admin's client gets ~2-3 invoices/month across the past 12 months (mostly PAID, some OPEN/BILL/RECEIPT), with 1 payment each, `paidAt` spread across months. Fixed a brace bug that had the payments loop nested inside the month loop (~7 payments per invoice).

### Docker

- `.npmrc` — added `force-legacy-deploy=true` so `pnpm deploy` keeps the `link:` overrides in the deployed node_modules (no more registry fallback to 0.8.1).
- `Dockerfile` — removed the now-redundant post-deploy overlay loop; documented `force-legacy-deploy`.

### Tests

- `packages/api/tests/e2e/dashboard.spec.ts` — DateInput segments filled in DD-MM-YYYY order (`['01','01','2025']`).
- `packages/api/tests/unit/dashboard-trpc.test.ts` — added `pickGranularity` unit tests.

## Verification

- `PI_RTK_BYPASS=1 pnpm run build` clean.
- Docker image deploys `@modular-api/fastify-checkout@0.8.4` (local) — bundle contains `paidRevenueSeries`/`pickGranularity`.
- Seed: 26 payments / 26 invoices, 2-3 payments per month over 12 months.
- Dashboard E2E: 11/11 pass. Revenue cards render €979.78 / €3,185.60 (non-zero).

## Follow-up (same day)

### dev merge

- Merged `dev` into `dashboard` (kept dashboard's newer deps: oxfmt 0.62,
  oxlint 1.77, vue-chartjs/chart.js, fastify-checkout 0.8.1). Lockfile
  regenerated via `pnpm install`, no hand-merged lockfile.

### Revenue chart binning caption

- Chart shows a caption explaining the time-bucketing (day/week/month)
  from the API's `granularity` field; lang keys in en-US/de/nl.
- Fixed future-dated seed payments: current-month payments capped at
  today so the default month preset no longer renders an empty chart.

### Test coverage (branch-wide audit)

- Unit: dateRange (8), statusConfig (4), aging buckets (4), formatCurrency
  cents->euros (5) in app; dashboard zod + pickGranularity (31) in api.
- E2E (15): binning caption day->month, all four action-item buckets,
  Receipts card, plus the earlier nav/filter/preset tests.
- Hardened flaky QSelect interactions (force click after attach).
