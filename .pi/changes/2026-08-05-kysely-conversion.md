# 2026-08-05 — Dashboard handler raw SQL → Kysely conversion

## What changed

**modular-api `@modular-api/fastify-checkout` (commit 5915b1e)** — `src/invoiceHandler.ts`, `src/index.ts`:

- All dashboard handler methods converted from raw `sql<...>` fragments to Kysely expression builders: `getInvoiceStatusCounts`, `getInvoiceOverdueAging`, `getPaidRevenue`, `getUpcomingIncome`, `getPaymentMethodSplit`, and the activity feed's reminder/exhortation queries.
- `getPaidRevenue` now receives `buckets: {start}[]` from the caller and returns `{buckets, series}` (no labels); the slimfact api composes labels.
- `getInvoiceOverdueAging` groups by param-free `jsonb_array_length(reminder_sent_dates)` (so SELECT/GROUP BY match in Postgres) and clamps to the 0..3 aging buckets in JS. Dropped unused `companyName`.
- `generate_series`, `date_trunc`/`to_char` rendering and date filters are now `eb.fn` calls; reminder/exhortation uses `eb.between`; `reminderCountExpression`/`companyNameExpression` helpers.

**slimfact (commit a3da47f2)** — `packages/api/src/trpc/admin/dashboard.ts`, `dashboard-trpc.test.ts`, `actionItems.ts`, `AGENTS.md`:

- `bucketStarts(dateFrom, dateTo, granularity)` + `bucketLabel(start, granularity)` pure functions (date-fns) replace the handler-side bucket generation; unit-tested.
- `OverdueAgingRow`/trpc type drops `companyName`.
- **AGENTS.md**: new Code Style guideline — prevent raw SQL, use Kysely methods whenever possible.

## Runtime bugs found & fixed during E2E debugging

1. `eb is not defined` — bare `eb.fn`/`eb.val` in plain-array `.select([...])`/`.where()` chains (eb only exists inside `(eb) =>` callbacks). Two sites fixed.
2. `invalid operator "between"` — `eb(expr, 'between', [a, b])` isn't valid; `ExpressionBuilder.between(expr, a, b)` is (0.29.4).
3. `column invoices.reminder_sent_dates must appear in GROUP BY` — expression with `eb.val` params compiles to different param slots in SELECT vs GROUP BY; fixed by param-free group expression + JS clamp.
4. RTK compression hides tsc errors (`✓ Build successful` even on failure) — `PI_RTK_BYPASS=1` reveals them; fixed `$castTo<string>`, `buckets` signature, typed `documentNumberFor` row casts.

## Verification

- modular-api: `tsc --noEmit` clean (PI_RTK_BYPASS=1)
- slimfact api unit 52/52, app unit 73/73
- Dashboard E2E 22/22 (`dashboard.spec.ts`, workers=1, nosetup config)

## Follow-up: analytics extraction (commits modular-api c713eaf, slimfact d6301e43)

The six read-only statistics methods (getInvoiceStatusCounts, getInvoiceOverdueAging,
getPaidRevenue, getUpcomingIncome, getPaymentMethodSplit, getActivityFeed) moved out of
invoiceHandler.ts into src/analytics.ts as pure functions taking `kysely` per call (no
handler instance). Exposed via the `@modular-api/fastify-checkout/analytics` subpath; the
dashboard trpc imports them directly, passing the shared `db` instance, and drops the
`as unknown as` casts + no-invoice-handler guards. Gotcha: the dashboard-trpc unit test now
imports kysely → config, so api unit tests need `POSTGRES_PASSWORD` + `POSTGRES_DB` env
vars; and any `pnpm exec` in packages/api reverts the fastify-checkout symlink to the
stale registry copy (re-link before `pnpm test`).
