# 2026-09-17 — "Vervalt op …" only for open invoices; no payment term on bills

## Why

The invoice list showed a payment deadline (`lang.invoice.labels.dueBy`) on every
invoice that carried a `dueDate`, regardless of status. The send/numbering
handler stamps the due date on invoices that are already settled too: it sets
`status: InvoiceStatus.OPEN` when an amount is still due, otherwise
`InvoiceStatus.PAID`, and writes `dueDate` either way — so a paid invoice kept
advertising a deadline that no longer applied.

Second half of the same story: a due date is an **invoice-only field**.
`openInvoice` is its only writer in the product and it only runs for numbered
invoices, so bills and receipts must not carry one — but the demo seeder
backfilled a `dueDate` on _every_ seeded row, so seeded bills/receipts had a
deadline. That leaked past the list: the typst bill PDF renders the payment line
only when `invoice.dueDate != none` (`templates/invoice/default.typ`), so a bill
with a due date printed "Te betalen binnen 14 dagen (voor …)".

Third: the shared invoice form asked every document for a payment term, including
bills and receipts, where nothing reads it back.

## What changed

- `packages/app/src/utils/invoice.ts` (new rules module): `showsDueDate(invoice)`
  — open status plus a due date; `hasPaymentTerm(status)` — false for bills and
  receipts.
- `packages/app/src/components/invoice/InvoiceExpansionItem.vue`: the caption's
  `v-if` uses the new `showDueDate` computed instead of `modelValue.dueDate`.
- `packages/app/src/components/invoice/InvoiceForm.vue`: new optional `status`
  prop; the "Betalingstermijn in dagen" input is hidden when the document has no
  payment term. The value is still submitted (the api's create/update input
  requires `paymentTermDays: number`), so this is a hide, not a removal.
- `packages/app/src/pages/admin/BillsPage/BillsPage.vue`: both forms (create and
  update) pass `:status="InvoiceStatus.BILL"`. InvoicesPage and
  SubscriptionsPage pass nothing → the field stays; ReceiptsPage has no form.
- `packages/api/src/kysely/seeds/demo.ts`: the backfill loop stamps a due date for
  numbered invoices only and writes an explicit `NULL` for unnumbered
  bill/receipt documents.
- `packages/api/tests/unit/banking/demo-seed.spec.ts`: the invariant is asserted
  on the seeded world (numbered → has a due date, unnumbered → none).
- Tests: `packages/app/tests/unit/invoiceDueDate.test.ts` and
  `invoicePaymentTerm.test.ts` (truth tables over every status).
- `.changeset/show-invoice-deadline-only-when-open.md` (app half only; the seeder
  is a dev fixture, so no changeset).

## Scope note on the app tests

This package has no component-mounting harness (`@vue/test-utils` is not a
dependency; every spec under `tests/unit/` is pure logic), so the tests cover the
_predicates_ the template binds to, not the rendered DOM. Making them assert the
DOM would mean adding a mount harness plus the Quasar plugin for two `v-if`s.

## Not touched, deliberately

- The dashboard's "vervalt op" lines: `getInvoiceOverdueAging` and
  `getUpcomingIncome` already filter `status = open` in SQL.
- Bank linking: `listLinkCandidates`/`getSuggestions` filter `open` as well, and
  `apply.ts`'s gate for bills is status-only, so it never reads a bill's due date.
- `openInvoice` (linked repo): its only guard is "not already numbered", so a bill
  _could_ be numbered through the API and would then take `today +
paymentTermDays` — i.e. the default 14 from the hidden input. No app path does.

## Verified

- Fresh throwaway Postgres + `migrate:latest` + `seed:demo`, then
  `group by status`: **bill 87 rows / 0 with a due date**, **receipt 63 / 0**,
  open 2 / 2, paid 31 / 31, canceled 17 / 17.
- `demo-seed.spec.ts` (DB-gated, run against that throwaway DB): 9 passed,
  including the new invariant. The spec truncates and re-seeds, so it exercises
  the seeder rather than the row I seeded by hand.
- App suite via the package's own runner (`vitrify test`): 12 files / 82 tests
  pass (7 new). `vue-tsc --noEmit -p tsconfig.json` exits 0, `oxlint src` and
  `oxfmt --check .` clean (only the pre-existing `src/tools.ts` warning).
