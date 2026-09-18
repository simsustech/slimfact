# 2026-09-18 — filter selects no longer render "NaN"

## Why

`/admin/invoices`' client filter (and the company one beside it) showed `NaN` in
the input. Root cause: the filter state for the four list pages used `NaN` as its
"unset" sentinel — `useAdminGetInvoicesQuery` initialises `companyId`/`clientId`
as `ref(NaN)`, `applyRouteFilters` only parses `companyId` (never `clientId`, so
the initial NaN survives), and the pages write `NaN` back on clear and on
"search by client name". A Quasar `QSelect` with `map-options` renders a model
that matches no option verbatim, so an empty filter displayed `NaN`.

Why it looked "already fixed": it was. `fe2eb93d` (2026-08-20, same patch as
`d84038e7` on the open-banking branch — a cherry-pick duplicate) replaced two
sites, but (a) the open-banking squash `d4253f24` reverted the `applyRouteFilters`
hunk back to `companyId.value = NaN`, and (b) that fix never touched the state
(no `queries/admin/*` file in the commit), only two consumers. The only test was
`administrator.spec.ts`'s assertion on the **form's** Company combobox in the
Add-bill dialog — never a list-page filter.

## What changed

- `queries/admin/invoices.ts`, `bills.ts`, `receipts.ts`, `subscriptions.ts`:
  `companyId`/`clientId` are `ref<number | null>(null)`.
- `pages/admin/InvoicesPage/InvoicesPage.vue`: the `applyRouteFilters` else
  branch, `onNewValueClients` and `clearSearchResults` reset to `null`.
- `pages/admin/BillsPage/BillsPage.vue`, `pages/admin/ReceiptsPage.vue`,
  `pages/admin/SubscriptionsPage/SubscriptionsPage.vue`: same resets, plus the
  two `activeSearch` computed properties in receipts/subscriptions, which used
  `!Number.isNaN(model)` as a presence test — that inverts once the unset value
  is `null` (`Number.isNaN(null)` is `false`, so `!false` made the "clear search"
  icon look active with no filter set). They now test `!= null`.
- `pages/admin/PaymentsPage/PaymentsPage.vue`: stale comment ("NaN = unset") —
  that page was already correct (`number | null`, `parseIdParam` → `undefined`).
- Removed the dead `// const sendBillEmailId = ref(NaN)` comments in the
  invoices and bills pages.
- `AGENTS.md` (Code Style): the convention — select/filter state is `null`, never
  `NaN`; test presence with `!= null`.
- New guard `packages/app/tests/unit/noNanSelectState.test.ts`: scans
  `packages/app/src/**/*.{ts,vue}` and fails on a `NaN` sentinel in filter state
  (assignments to `companyId`/`clientId`, untyped `ref(NaN)`,
  `Number.isNaN(companyId|clientId)` presence checks). It has a self-check
  (the walk found >100 files) so a broken scan can't pass vacuously.
- New e2e assertion in `packages/api/tests/e2e/invoices-date-filter.spec.ts`:
  with the invoices filter menu open, the `Company` and `Client` comboboxes must
  not have the value `NaN`.
- `.changeset/null-select-defaults.md`.

## Deliberately left

- `queries/admin/email.ts` and `invoiceEvents.ts` keep `ref<number>(NaN)`: those
  ids are never bound to a select, and `enabled: !Number.isNaN(id.value)` gates
  the query because `getInvoiceEmail`/`getInvoiceEvents` take `z.number()`
  (not nullable). The 3 `sendEmailId.value = NaN` resets in the pages go with
  them. The guard's allowlist pins exactly these two files, so a third one fails
  the test until someone decides otherwise.
- `components/numberPrefix/NumberPrefixSelect.vue:10`
  (`:hide-selected="Number.isNaN(modelValue)"`) — a package-style band-aid whose
  model is a prefix id/template that is never NaN in practice, so the attribute
  is effectively off. Changing it would alter dropdown behaviour, not fix a bug.

## Found in this sweep, fixed right after

`components/invoice/InvoiceForm.vue:416`: in `setValue`, the client branch reads
`newValue.clientDetails.id` and assigns it to **`modelValue.companyId`** — the
company field. The company branch above assigns `companyId` correctly, and the
clientId branch is skipped when `newValue.clientId` is set, so this looks like a
copy-paste that writes the wrong field (`clientId` is the plausible intent). Left
alone because it changes form behaviour, has no test coverage, and the intent
("client implies company"?) is the author's call.

## Verified

- `pnpm test` in `packages/app` (its own runner, `vitrify test`): 13 files / 87
  tests pass (5 new).
- Negative control for the guard: planting
  `clientId.value = NaN` in a new `src/zz-guard-probe.ts` makes
  `noNanSelectState.test.ts` fail on the right assertion (probe deleted
  afterwards). This is the check that would have caught the `d4253f24` revert.
- `npx vue-tsc --noEmit -p tsconfig.json` exit 0 — confirms the api inputs accept
  `null` (`getInvoices`/`getSubscriptions` are
  `z.number().nullable().optional()`).
- Root `pnpm run lint` and `pnpm run format:check` clean (only the pre-existing
  warnings in `packages/api`/`packages/tools`).
- **Not executed**: the new Playwright assertion. No SlimFact stack is running on
  this machine (`docker ps` shows only unrelated containers), so the e2e spec
  needs the usual test stack; the assertion mirrors the existing, working
  `not.toHaveValue('NaN')` pattern from the same dialog flow.
