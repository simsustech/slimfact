# @slimfact/app

## 0.9.1

### Patch Changes

- 6c1c84f: Admin dashboard: a full analytics dashboard at `/admin/dashboard` (the
  `/admin` menu-list landing page is unchanged).

  **Revenue section**

  - Three summary cards (Invoices / Bills / Receipts) for the selected period
    with Today / Week / Month / Quarter / Year presets plus a custom date
    picker (dates formatted with the new `DATE_FORMAT` env config).
  - Grouped revenue chart (one series per invoice status per time bucket) with a
    COMPLETE, zero-filled axis: the whole selected period is always covered,
    binned by day (<=10d), week (ISO week numbers, <=45d), month (<=200d) or
    quarter (`YYYY-Qn`, beyond). Presets span the full calendar period
    (week Mon..Sun, month 1st..last, year Jan 1..Dec 31). Clicking any bar
    zooms the dashboard into that bucket's period (e.g. clicking a quarter
    in year view selects that quarter and re-bins by month).

  **Cards**

  - **Outstanding debtors** (replaces the status doughnut): top companies by
    open-invoice amount with an Invoices | Bills toggle; clicking a row opens
    the filtered invoices list.
  - **Action items**: open-invoice total plus the four overdue aging buckets
    (needsReminder / reminder1 / reminder2 / exhortation). Fixed to sum
    across ALL companies (previously only the first company's row was used).
  - **Upcoming income**: not-yet-due OPEN invoices (total, count, next three
    due dates) with an Upcoming | Overdue toggle showing the overdue aging
    buckets, so `upcoming + overdue = open invoices`.
  - **Paid by payment method**: share of paid revenue per method for the
    selected period, using the frontend payment-method labels.
  - **Recent activity**: filterable, paginated timeline. Payment entries now
    show the amount and "for invoice #<number>"; the body slot was fixed
    (Quasar's QTimelineEntry has no `#body` slot, only `default`).
  - Multi-company filter feeds every card.

  **Shared code**

  - `@slimfact/tools` gets a main entry exporting `formatPrice` (cents →
    localized price, optional currency symbol) and `formatDate`
    (YYYY-MM-DD → configured format). The DigiBoox export and invoice emails
    reuse `formatPrice`; the app's duplicate formatters were removed.
  - `DashboardPage` moved to `src/pages/admin` with `<q-page>`.
  - Extracted testable modules (`dateRange`, `actionItems`, `recentActivity`,
    `revenueSeries`, `paymentMethods`, `topDebtors`) with unit tests.

  **Backend (`@modular-api/fastify-checkout`)**

  - Dashboard statistics ship as pure functions in the new
    `@modular-api/fastify-checkout/analytics` subpath:
    `getInvoiceStatusCounts`, `getInvoiceOverdueAging`, `getPaidRevenue`,
    `getUpcomingIncome`, `getPaymentMethodSplit`, `getActivityFeed` — each
    takes the Kysely instance per call. Leaf helpers (e.g.
    `buildReminderSentDates`) live in the new
    `@modular-api/fastify-checkout/helpers` subpath.
  - The api imports both subpaths; the tRPC routes
    `admin.getDashboardStats` / `admin.getDashboardActivity` feed the page.
  - `@slimfact/tools` gains a `./dashboard` subpath with the aging-bucket
    mapping (`agingLabelForReminderCount`, `AGING_LABELS`,
    `EXHORTATION_THRESHOLD`) as the single source of truth, replacing the
    duplicated api/app copies.
  - Bump the `@modular-api/fastify-checkout` dependency to the version that
    ships the `./analytics` and `./helpers` subpaths.

  **Seed**: realistic 12-month spread of payments, OPEN/PAID invoices go
  through the real `openInvoice()` flow (numbers + due dates), `createdAt`
  backdated so the activity feed shows a natural spread.

  Adds `vue-chartjs@^5.3.4` and `chart.js@^4.5.1` as dependencies.

- 6c1c84f: Add pricing and comparison pages to docs, screenshot infrastructure, guard validation tests, and CI workflow improvements. Fix email tracking documentation and export format claims.
- 6c1c84f: Rebrand iDEAL to Wero across the app and API. The product-level payment method is now `wero` (label "Wero | iDEAL", `arcticons:wero` icon) while the PSP-level method stays `ideal` (Wero rides on iDEAL rails) via translation in `@modular-api/fastify-checkout`. Shift test-stack Docker ports (db 5433, mailhog 1027/8027) to avoid clashing with the petboarding dev stack. Fix a flaky `mkBill` e2e helper that waited on Quasar expansion-item content visibility; it now waits for the invoice "Open" link to appear instead.
- Updated dependencies [6c1c84f]
- Updated dependencies [6c1c84f]
- Updated dependencies [6c1c84f]
  - @slimfact/tools@0.9.1
