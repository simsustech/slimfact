# 2026-08-13 — date-range filter for invoices / bills / receipts

Implemented the effective-document-date filter (`COALESCE(date, created_at)`) on the admin invoice, bill and receipt lists. Plan: `.pi/plans/2026-08-13-filter-invoices-bills.md` (run: success).

## Files changed

**External linked package (`~/Projects/modular-api/packages/fastify-checkout`)** — needed by the Docker E2E overlay:

- `src/invoiceHelpers.ts` — new exported `documentDateExpression` (coalesce of `date` and `date(created_at)`).
- `src/invoiceHandler.ts` — `getInvoices` date clauses now use `documentDateExpression` (inclusive `>=`/`<=`).

**SlimFact:**

- `packages/api/tests/e2e/invoices-date-filter.spec.ts` — **new** E2E spec (5 scenarios).
- `packages/api/src/trpc/admin/invoices.ts` — `getInvoices` input accepts + forwards `startDate`/`endDate` (`z.string().optional()`). Also fixed 2 pre-existing type errors in this file (invoiceHandler optional chaining; transactionReference `?? undefined`).
- `packages/app/src/lang/{index,en-US,nl,de}.ts` — `invoice.filters.{startDate,endDate}` keys.
- `packages/app/src/queries/admin/{invoices,bills,receipts}.ts` — per-page `startDate`/`endDate` refs + `validIso` guard (strips `_`-padded DateInput partials), wired into colada key + tRPC params, returned from the hook.
- `packages/app/src/pages/admin/InvoicesPage/InvoicesPage.vue`, `BillsPage/BillsPage.vue`, `ReceiptsPage.vue` — DateInputs in the filter menu (after the existing selects), read-only URL sync (`applyRouteFilters` for invoices; `onBeforeRouteUpdate` + setup for bills/receipts), `activeSearch`/`clearSearchResults` extended.

## Why

User requested filtering the admin invoice/bill/receipt lists by start/end date. Explicit decision (Option B): the filter column is the effective document date — bookkeeping `date`, falling back to `created_at` for undated documents (concept, bill, receipt, canceled). Account/customer portal untouched. URL filtering is read-only (no `router.replace`), per-page state is independent.

## Verification

- E2E (Docker stack, `--workers=1 --config=playwright.nosetup.config.ts`): new spec 5/5; regression `invoices-date-filter + invoice-flow + administrator` 15/15.
- `pnpm run lint` (root) exit 0; `PI_RTK_BYPASS=1 pnpm run build` (root) green; fastify-checkout `pnpm build` green.

## Notes

- The test stack seeds `seed:test` + `seed:fake`; seed:fake uses only relative dates, so 2020-range empty-state assertions are safe.
- `invoice-flow.spec.ts` "BILL → RECEIPT (paid bill)" never actually converts a bill (its `/receipt/i` locator matches the Receipts drawer link; assertion passes on seeded fake receipts). The new receipts scenario is the first real coverage of the conversion UI flow.
- Not committed (per run policy); external package changes are uncommitted on the modular-api `event-bus` branch.

## Follow-up refinements (same day, after review)

- `packages/tools/src/index.ts` now exports `validIsoDate` (strict YYYY-MM-DD, strips
  `_`-padded DateInput partials) and `dateQueryParam(query, key)` (reads a date query param,
  validates through `validIsoDate`). The three admin query hooks import `validIsoDate`;
  the three admin pages read URL dates via `dateQueryParam` (replaces 5 verbose if/typeof blocks).
- `packages/app/src/configuration.ts` exports a shared `DATE_FORMAT` computed; the local
  `const DATE_FORMAT = computed(...)` definitions were removed from InvoicesPage, BillsPage,
  ReceiptsPage, DashboardPage, ExportsPage and SubscriptionForm (import now from configuration.js).
- `packages/api/src/trpc/admin/invoices.ts`: dropped `.nullable()` from the zod
  `transactionReference` (the app only ever sends `''`), removing the `?? undefined` coercion
  and fixing the pre-existing `string | null` → `string | undefined` type error at the root.
- Verified after refactor: `invoices-date-filter` 5/5, `invoice-flow` + `administrator` 10/10,
  root `pnpm run lint` exit 0, `PI_RTK_BYPASS=1 pnpm run build` green, tools `pnpm build` green.

## Test-stack note (sandbox)

The user's vite dev server holds host ports 3000 + 3001 (invisible to the sandbox, must not be
killed), so the Docker test stack is brought up with a compose override
(`/tmp/slimfact-caddy-port-override.yaml`) that drops caddy's `3000` and the api's `3001` host
bindings via the `!override` merge tag (Playwright reaches the api via caddy on 443).
