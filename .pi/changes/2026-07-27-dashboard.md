# 2026-07-27 — Dashboard

## Scope

Replace `/admin` landing with a real dashboard. New admin landing pages contain:

- Revenue cards (invoice + bill totals)
- Revenue bar chart
- Status overview doughnut chart
- Action items (Open + 4 overdue buckets)
- Recent activity timeline (filterable)
- Company filter (multi-select, hidden when single company)
- Date range presets (Today/Week/Month/Quarter/Year) + custom range
- Existing DashboardAdminMenuList preserved at the bottom

## Files changed (slimfact worktree)

### New files

- `packages/api/src/zod/dashboard.ts` — Zod schemas (`getDashboardStatsInput`, `getDashboardActivityInput`, `eventTypeEnum`, `dateSchema`)
- `packages/api/src/trpc/admin/dashboard.ts` — tRPC routes `getDashboardStats` + `getDashboardActivity` + `dashboardDateRangeForPreset` helper
- `packages/api/tests/unit/dashboard.test.ts` — 15 zod tests
- `packages/api/tests/unit/dashboard-trpc.test.ts` — 13 tRPC tests (date presets, aging labels, event-type filtering)
- `packages/api/tests/e2e/dashboard.spec.ts` — 10 E2E tests (all unskipped; runtime verification pending — see "Verification gaps" below)
- `packages/app/src/queries/admin/dashboard.ts` — Pinia Colada queries (`useAdminGetDashboardStatsQuery`, `useAdminGetDashboardActivityQuery`)
- `packages/app/src/components/dashboard/DashboardRevenueCards.vue` — Revenue display cards
- `packages/app/src/components/dashboard/DashboardRevenueChart.vue` — vue-chartjs Bar wrapper
- `packages/app/src/components/dashboard/DashboardStatusChart.vue` — vue-chartjs Doughnut wrapper
- `packages/app/src/components/dashboard/DashboardActionItems.vue` — 5 clickable QItems
- `packages/app/src/components/dashboard/DashboardRecentActivity.vue` — QTimeline + QSelect filter
- `packages/app/src/components/dashboard/DashboardPage.vue` — Parent orchestrator

### Modified files

- `packages/api/src/trpc/admin/index.ts` — Register dashboard routes
- `packages/app/src/pages/AdminPage.vue` — Replace `DashboardAdminMenuList` with `DashboardPage`
- `packages/app/src/lang/index.ts` — `Language` type extended with `dashboard.admin.*` keys
- `packages/app/src/lang/en-US.ts`, `nl.ts`, `de.ts` — translations for new keys
- `packages/app/package.json` + `pnpm-lock.yaml` — added `vue-chartjs@^5.3.4` and `chart.js@^4.5.1`

### Modified files (external repo)

- `~/Projects/modular-api/packages/fastify-checkout/src/index.ts` — added 5 method signatures + `ActivityEventType` type to `FastifyCheckoutInvoiceHandler`
- `~/Projects/modular-api/packages/fastify-checkout/src/invoiceHandler.ts` — added 5 method implementations + `extractClientName` + `parseReminderDates` helpers

## Tactics deviation

Per user OK (option A in the checkpoint), I introduced targeted `sql\`...\``template literals in`fastify-checkout/src/invoiceHandler.ts` for:

- `current_date` comparison in `getInvoiceOverdueAging`
- `LEAST(jsonb_array_length(...), 3)` aggregate in `getInvoiceOverdueAging`
- `max(...->>'name')` JSON extraction in `getInvoiceStatusCounts`
- `BETWEEN 1 AND 2` / `>= 3` reminder-count filters in `getActivityFeed`

The plan's tactic was "Zero `sql` template literals"; the user authorised 5 narrow escapes to make pure-Kysely typings accept the queries. `tsc --noEmit` is green for the package.

## Verification status

| Gate                                              | Status        | Notes                                       |
| ------------------------------------------------- | ------------- | ------------------------------------------- |
| Step 1 — zod unit tests                           | ✅ 15/15 pass | `tests/unit/dashboard.test.ts`              |
| Step 3 — tRPC unit tests                          | ✅ 13/13 pass | `tests/unit/dashboard-trpc.test.ts`         |
| Step 2 — fastify-checkout `tsc --noEmit`          | ✅ green      | 5 method signatures + implementations added |
| API `tsc --noEmit`                                | ✅ green      | No new errors                               |
| API `pnpm lint`                                   | ✅ green      | Pre-existing warnings only                  |
| API `oxfmt --check`                               | ✅ green      | After `format:write` run                    |
| App `pnpm run build`                              | ✅ green      | Full SSR build successful                   |
| App `pnpm lint`                                   | ✅ green      | Pre-existing warnings only                  |
| `pnpm run build` (workspace)                      | ✅ green      | tools + app + api build                     |
| E2E runtime (10 dashboard tests + existing suite) | ⚠️ deferred   | Requires Docker test stack — user to run    |

## Verification gaps

- **Step 2 (fastify-checkout):** No test infrastructure in `~/Projects/modular-api/packages/fastify-checkout` (no `test` script, no Postgres test DB). I added the methods and they type-check green, but I did not run any integration test against the new methods. Once a fresh build of `@modular-api/fastify-checkout` is published (or pnpm-linked into slimfact via the `LINKED_MODULAR_API_FASTIFY_CHECKOUT_PATH` Docker overlay), runtime behaviour should be exercised via the E2E suite.
- **Step 13 E2E:** `pnpm run test:e2e` invokes Playwright with `globalSetup: ./tests/e2e/global-setup.ts` which rebuilds the Docker test stack. I did not run this. Recommend the user run it manually before shipping.
- **Step 14 screenshots:** `playwright test tests/e2e/screenshots-admin.spec.ts` requires the same Docker stack. Not run.

## Things to do before shipping

1. Decide how to land the `~/Projects/modular-api` changes:
   - Option A: publish a new version of `@modular-api/fastify-checkout` (e.g. `0.9.0`) and bump the version in `packages/api/package.json` + `pnpm-lock.yaml`.
   - Option B: use the `LINKED_MODULAR_API_FASTIFY_CHECKOUT_PATH` Docker overlay (per AGENTS.md).
   - Without (1), the new tRPC routes will fail at runtime because `fastify.checkout.invoiceHandler.getInvoiceStatusCounts` etc. won't exist on the published `@modular-api/fastify-checkout@0.8.1`.
2. Run `pnpm run test:e2e` against the Docker test stack to verify all 10 dashboard E2E tests + regression.
3. Run `pnpm exec playwright test tests/e2e/screenshots-admin.spec.ts --project=chromium` and inspect `packages/docs/public/screenshots/` for the dashboard.
4. Inspect edge cases the plan calls out (overdue with no due_date, reminder array ≥3, single-company behaviour) — none of these have explicit unit tests in this work; the existing E2E suite's seeded data should exercise them naturally.
