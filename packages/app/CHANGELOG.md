# @slimfact/app

## 0.9.3

### Patch Changes

- 7869730: Edit a bill whose client came from details alone, and fetch the document-form
  lists on demand instead of on every page mount.

  `InvoiceForm` gated its lines/discounts/surcharges section on
  `companyId != null && clientId != null`. A document whose client is invoicing
  details without a linked record — filled through the select's edit button, which
  is exactly how a walk-in client is captured — therefore hid its own line list:
  there was nothing to edit. The section now shows when either a `clientId` **or**
  `clientDetails.email` is present, mirroring the rule the client select already
  applied when deciding whether the field was satisfied.

  The company, client and number-prefix lists were fetched at page mount by the
  bills, invoices, receipts, subscriptions and exports pages, so opening any of
  them ran the invoice form's supporting queries whether or not a dialog would ever
  be opened. The three composables are lazy now (`activate()`), and every consumer
  calls it at the point the data is actually needed: the document dialog on open,
  the filter selects on their filter event, and the settings pages on mount. The
  `getInvoices` page's own data is unchanged and starts at the same time it always
  did.

  The suggestion count went the same way. It was fetched by the layout on every
  admin page, and because it rides the same tRPC batch as the page's own queries,
  building the entire suggestion list delayed the page. It is now started from an
  idle callback after the page has settled, which puts it in a **separate** batch
  (`admin.getInvoices,admin.getInvoices` then `admin.listSuggestions`).

  The e2e `fillComboboxes` helper opened a select with Playwright's
  `locator.click()`. Inside a dialog taller than the 720px default viewport the
  field sits outside it: Playwright refuses the click and its attempt to scroll
  fights the dialog's own scroll container, producing the visible up/down jitter.
  The helper now clicks the `.q-field__control` in the DOM, which the select handles
  the same way and which no scrolling behaviour can veto.

  A seeded walk-in bill (2026-15, `clientDetails` with no `clientId`) and an
  invoice-flow spec cover the edit path end to end.

- 313fdce: Stop the invoice form from relinking a document whose client was cleared, and
  reject payloads whose details contradict the link.

  `InvoiceForm`'s `setValue` resolved a missing `clientId` from `clientDetails.id`
  and assigned it to `companyId`. The assignment was wrong, but resolving a link out
  of the details was the real problem: `companyId`/`clientId` are the **link** to the
  SlimFact records, while `companyDetails`/`clientDetails` are the invoicing
  **details** printed on the document, which may carry no `id` at all. The company
  and client selects now bind only the keys, assigned unconditionally so a reset
  cannot keep a previous document's selection.

  A details id matters on the write path, not on read: the create/update procedures
  take the stored key _from_ `clientDetails.id`/`companyDetails.id` when no key is
  supplied. The form therefore submits the details without their id
  (`withoutDetailsId`). Before this, an edited document whose client was cleared still
  carried the details id loaded from the api, so saving put the client back —
  clearing the select could not unlink anything.

  `detailsLinkMismatch` (`@slimfact/api`'s zod invoice module) now rejects a
  create/update payload whose details id disagrees with a link that is also present,
  so the contradiction cannot reach the database from any api caller.

- 313fdce: Stop the company and client filter selects from rendering "NaN".

  The filter state for invoices, bills, receipts and subscriptions used `NaN` as
  its "unset" sentinel — the query composables initialised `companyId`/`clientId`
  as `ref(NaN)` and the list pages wrote `NaN` back on clear and on "search by
  client name". A Quasar `QSelect` with `map-options` renders a model that matches
  no option verbatim, so an empty filter displayed `NaN` in the input, and the
  `!Number.isNaN(...)` presence checks in the receipts and subscriptions pages made
  the "clear search" icon look active with no filter set.

  The models are now `number | null` and `null` is the unset value everywhere
  (`invoices.ts`, `bills.ts`, `receipts.ts`, `subscriptions.ts`). The api was
  already prepared for it: `getInvoices` and `getSubscriptions` declare
  `companyId`/`clientId` as `z.number().nullable().optional()`.

  `packages/app/tests/unit/noNanSelectState.test.ts` fails if a `NaN` sentinel
  returns to filter state, and `invoices-date-filter.spec.ts` asserts the filter
  selects in the running app are empty rather than `NaN`.

- @slimfact/tools@0.9.3

## 0.9.2

### Patch Changes

- d4253f2: Show a confirmation dialog before dismissing a bank suggestion in the PaymentsPage suggestions tab. Dismissal hides the credit→company suggestion, so the action now asks "Are you sure …?" (localized EN/NL/DE) and only dismisses on confirm.
- ac65632: Add a start/end date-range filter to the admin invoice, bill and receipt
  lists, filtering on the effective document date
  (`COALESCE(date, created_at)` from `@modular-api/fastify-checkout@0.9.1`) so
  undated documents (concept, bill, receipt, canceled) match via their
  creation date. URL params (`startDate`/`endDate`) apply read-only on load and
  route update; the filter menu gains two DateInputs. Shared helpers
  `validIsoDate` and `dateQueryParam` were added to `@slimfact/tools`, and
  `DATE_FORMAT` is now a single shared computed in `configuration.ts`.
- d4253f2: Add pricing and comparison pages to docs, screenshot infrastructure, guard validation tests, and CI workflow improvements. Fix email tracking documentation and export format claims.
- d4253f2: Payments page: treat status "paid" as including settled refunds. A refund's
  terminal status is "refunded" (not "paid"), so the ledger status filter
  silently hid every refund whenever "paid" was selected. Selecting "paid" now
  also returns refunded refunds — the money-out side of a paid payment. Other
  status selections stay payment-only. Implemented server-side in the shared
  ledger query, so the CSV export matches the on-screen view.
- d4253f2: Payments page: add company and client filters to the ledger filter menu.
  The ledger now joins through the payment's invoice, so payments can be
  narrowed to a company or client (both also apply to the CSV export). The
  filter state round-trips through the URL (companyId/clientId params), and
  explicit deep links bypass the fresh-view defaults like the other filter
  params.
- d4253f2: Payments page: render the ledger and suggestions date columns with
  formatDate in the configured DATE_FORMAT (DD-MM-YYYY) instead of raw ISO
  timestamps. Ledger dates arrive as full ISO timestamps, so the date part
  is sliced before token formatting; the UTC date is used to stay aligned
  with the server-side date filters.
- d4253f2: Payments page: render the filter menu's From/To date inputs in the
  configured DATE_FORMAT (DD-MM-YYYY) instead of the raw ISO order, matching
  the invoice/bill filter menus.
- d4253f2: Payments page (PaymentsPage): move the ledger filters (date range, method,
  status, PSP, source) into a QMenu opened by a Filters button; default the
  fresh (unfiltered) view to payments from the first day of the current year
  with status "paid"; and render a localized summary sentence of the active
  filters (e.g. "Payments from 01-01-2026 with status 'paid'"). Deep links that
  pass explicit filter params keep their exact semantics.
- d4253f2: Payments page: stop the filter menu closing itself. Two causes: the URL sync
  (usePaymentsUrlState) wrote the URL on any filters change — including no-op
  writes when the filter menu mounted — and QMenu's hideOnRouteChange then
  closed the menu on the resulting route change. The sync now compares against
  the URL's effective filters (fresh-view defaults included) so no-op writes
  are skipped, and the filter menu is no-route-dismiss so selecting filters
  keeps it open. Also fixed the round-trip so an absent source= param no longer
  resets the sources filter to none (and no longer appends a stray source= to
  the URL).
- d4253f2: Payments page: page through the whole ledger instead of only the first 50
  rows. The table fetched a single 50-row page and paginated client-side, so
  "1–50 of 50" appeared even when hundreds of payments matched the filters.
  The ledger table now runs in q-table server mode (@request): page requests
  translate into the tRPC limit/offset, the footer shows the server-reported
  total ("1–50 of 1,125"), and filter changes reset to page 1. The server owns
  the sort (newest first), so the date column is no longer client-sortable.
- e1f9298: Show the "Vervalt op …" deadline on open invoices only, and stop asking bills
  and receipts for a payment term.

  The caption rendered whenever an invoice carried a due date, but the send
  handler stamps one on invoices that are already settled as well — it sets the
  status to `paid` and writes the same `dueDate` — so a paid invoice kept
  advertising a payment deadline in the invoice list. `showsDueDate` in
  `src/utils/invoice.ts` holds the rule now, with a unit test over every status.

  The shared invoice form hid nothing, so bills and receipts asked for
  "Betalingstermijn in dagen" too. Nothing reads it back for them: `sendBill` and
  `sendReceipt` only email the document, and `openInvoice` — the only code that
  turns a term into a due date — is reachable only from the invoice send flow.
  The form takes the document status and hides the input for bills and receipts
  (`hasPaymentTerm`, same module, own unit test). Invoices keep the field.

- d4253f2: Rebrand iDEAL to Wero across the app and API. The product-level payment method is now `wero` (label "Wero | iDEAL", `arcticons:wero` icon) while the PSP-level method stays `ideal` (Wero rides on iDEAL rails) via translation in `@modular-api/fastify-checkout`. Shift test-stack Docker ports (db 5433, mailhog 1027/8027) to avoid clashing with the petboarding dev stack. Fix a flaky `mkBill` e2e helper that waited on Quasar expansion-item content visibility; it now waits for the invoice "Open" link to appear instead.
- Updated dependencies [d4253f2]
- Updated dependencies [d4253f2]
- Updated dependencies [ac65632]
- Updated dependencies [d4253f2]
- Updated dependencies [d4253f2]
  - @slimfact/tools@0.9.2

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
