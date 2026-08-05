# 2026-08-05 — Dashboard feature (merged recap)

Single up-to-date recap of the admin dashboard feature. Supersedes
`2026-07-27-dashboard.md`, `2026-08-04-dashboard-revenue-linechart.md`,
`2026-08-04-dashboard-complete-axis-zoom-formatprice.md` and
`2026-08-05-kysely-conversion.md` (all deleted — history lives in git log).

## Scope

New `/admin/dashboard` page with a full analytics dashboard (the
`/admin` menu-list landing page is unchanged):

- **Revenue cards** (Invoices / Bills / Receipts) for the selected period,
  with Today/Week/Month/Quarter/Year presets + custom date range (dates
  formatted via the `DATE_FORMAT` env config, default `DD-MM-YYYY`).
- **Revenue Bar chart**: COMPLETE zero-filled axis covering the whole
  period, binned day (≤10d) / week (ISO `2026-W32`, ≤45d) / month
  (≤200d) / quarter (`2026-Q3`), one series per invoice status; presets
  span the full calendar period; **click a bar to zoom** into that bucket.
- **Outstanding debtors** card (replaces the status doughnut): per-company
  OPEN amounts with Invoices | Bills toggle, row click opens the filtered
  invoices list.
- **Action items**: open-invoice total + the four overdue aging buckets
  (`needsReminder` / `reminder1` / `reminder2` / `exhortation`).
- **Upcoming income** card with Upcoming | Overdue toggle (title switches
  to "Overdue income" in overdue mode); `upcoming + overdue = open invoices`.
- **Paid by payment method** card: % bars per method for the period.
- **Recent activity**: filterable, paginated timeline; payment entries show
  the amount + "for invoice #N"; relative timestamps follow the app UI
  language.
- Multi-company filter feeds every card.

## Architecture (current state)

- `@modular-api/fastify-checkout/analytics` subpath — **six pure functions**
  (`getInvoiceStatusCounts`, `getInvoiceOverdueAging`, `getPaidRevenue`,
  `getUpcomingIncome`, `getPaymentMethodSplit`, `getActivityFeed`), each
  takes the Kysely instance per call (no handler instance). Kysely
  expression builders only, no raw SQL.
- `@modular-api/fastify-checkout/helpers` subpath —
  `buildReminderSentDates` (strict write-side validation, sorted),
  `isStrictIsoDate`, `documentNumberFor`, `extractClientName`, `addDays`,
  `todayIso`, `reminderCountExpression`, `companyNameExpression`,
  `uuidRegex`.
- `@slimfact/tools` main entry — `formatPrice` (cents → localized),
  `formatDate` (YYYY-MM-DD → configured format); reused by digiboox
  export, invoice emails, chart tooltips.
- `@slimfact/tools/dashboard` subpath — `agingLabelForReminderCount`,
  `AGING_LABELS`, `EXHORTATION_THRESHOLD` as the single source of truth
  (api trpc + app actionItems both import it).
- `packages/api/src/trpc/admin/dashboard.ts` — `getDashboardStats` /
  `getDashboardActivity` + pure helpers `pickGranularity`, `bucketStarts`,
  `bucketLabel`, `bucketEndDate` (lookup-map based).
- App: `src/pages/admin/DashboardPage.vue` (moved from components,
  `<q-page padding>`) + card components + pure modules (`actionItems`,
  `recentActivity`, `revenueSeries`, `paymentMethods`, `topDebtors`,
  `dateRange`), all unit-tested.

## Key decisions

- **Kysely-only, no raw SQL** (user directive): bucket generation moved to
  the api as pure date-fns functions; the handler zero-fills from
  caller-provided bucket starts. Validate before data reaches the DB.
- **`LEAST(..., 3)` aging clamp is bucketing, not a data rule** (documented
  in code): 4+ reminder dates are still possible via `exhortInvoice`
  (only requires ≥2); the clamp keeps the aggregation to four buckets and
  guarantees `agingLabelForReminderCount` never sees an undefined count.
- **Seed realism**: OPEN/PAID invoices go through the real `openInvoice()`
  flow (number + rendered prefix + future due date); `createdAt` backdated
  across 12 months; payments spread across months; the most recent payment
  is guaranteed to land on a numbered PAID invoice (makes the
  `recent-activity-filter` E2E deterministic); one overdue invoice per
  aging bucket guaranteed.
- **Postgres aggregates are strings** (bigint/numeric): all
  count/totalAmount coerced with `Number()` in the analytics handlers.
- **`formatRelative` uses `lang.value.isoName`** — Quasar's `$q.lang` is
  NOT installed in this app (a `$q.lang.isoName` attempt crashed the
  timeline; the E2E caught it).

## Kysely gotchas (runtime bugs found & fixed)

1. `eb.fn`/`eb.val` are only valid inside `(eb) =>` callbacks — bare `eb.`
   in a plain-array `.select([...])`/`.where()` chain throws
   `eb is not defined` at runtime (tsc does not catch it).
2. An expression with `eb.val` params used in BOTH `.select()` and
   `.groupBy()` compiles with different param slots ($1 vs $6) → Postgres
   `must appear in the GROUP BY clause`. Fix: param-free groupBy expression
   (`jsonb_array_length`) + JS clamp.
3. `eb(expr, 'between', [a, b])` is invalid (`invalid operator "between"`);
   use `eb.between(expr, a, b)` — Kysely 0.29.4 has no `whereBetween`.
4. `eb.fn('to_char', ...)` is typed `unknown` → `.$castTo<string>()`
   (not `.castTo`).
5. Callback `.select((eb) => [...])` rows fall back to
   `{[x: string]: any}` typing — cast rows at use sites.
6. RTK-compressed builds report `✓ Build successful` even when tsc fails →
   always use `PI_RTK_BYPASS=1`.
7. `pnpm exec` / root `pnpm run build` in the slimfact worktree reverts the
   api's `@modular-api/fastify-checkout` symlink to the stale registry copy
   (0.8.1, no subpaths) — re-link before local tests. Api unit tests also
   need `POSTGRES_PASSWORD` + `POSTGRES_DB` env vars (the dashboard trpc
   imports kysely → config).

## Changesets

One per feature branch (both describe the final API):

- modular-api `.changeset/dashboard-revenue-and-cards.md` — **minor**:
  `./analytics` + `./helpers` subpaths, breaking changes (root
  `buildReminderSentDates` removed, six methods off the invoice handler).
- slimfact `.changeset/dashboard-revenue-and-cards.md` — patch
  (api/app/tools): dashboard feature, tools `./dashboard` subpath, the
  fastify-checkout dependency bump, chart.js/vue-chartjs deps.
