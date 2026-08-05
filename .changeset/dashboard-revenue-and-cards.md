---
"@slimfact/api": patch
"@slimfact/app": patch
"@slimfact/tools": patch
---

Admin dashboard: replaces the old menu-list landing page with a full
analytics dashboard.

**Revenue section**

- Three summary cards (Invoices / Bills / Receipts) for the selected period
  with Today / Week / Month / Quarter / Year presets plus a custom date
  picker (dates formatted with the new `DATE_FORMAT` env config).
- Grouped bar chart (one bar per document type per time bucket) with a
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

**Backend (`@modular-api/fastify-checkout` invoice handler)**

- `getInvoiceStatusCounts`, `getInvoiceOverdueAging`, `getOutstandingTotal`.
- `getPaidRevenue`: full bucket series via `generate_series`
  (day/week/month/quarter), zero-filled, `{ labels, buckets, series }`.
- `getUpcomingIncome` (count/total + soonest 3, aggregated in SQL),
  `getPaymentMethodSplit` (paid revenue by method in a date range).
- `getActivityFeed` entries carry `documentNumber` (null for drafts).
- New tRPC routes `admin.getDashboardStats` / `admin.getDashboardActivity`
  feed the page.

**Seed**: realistic 12-month spread of payments, OPEN/PAID invoices go
through the real `openInvoice()` flow (numbers + due dates), `createdAt`
backdated so the activity feed shows a natural spread.

Adds `vue-chartjs@^5.3.4` and `chart.js@^4.5.1` as dependencies.
