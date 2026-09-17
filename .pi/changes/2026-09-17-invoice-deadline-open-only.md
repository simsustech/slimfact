# 2026-09-17 — "Vervalt op …" only for open invoices

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
backfilled a `dueDate` on *every* seeded row, so seeded bills/receipts had a
deadline. That leaked past the list: the typst bill PDF renders the payment line
only when `invoice.dueDate != none` (`templates/invoice/default.typ`), so a bill
with a due date printed "Te betalen binnen 14 dagen (voor …)".

## What changed

- `packages/app/src/utils/invoice.ts` (new): `showsDueDate(invoice)` — open
  status plus a due date.
- `packages/app/src/components/invoice/InvoiceExpansionItem.vue`: the caption's
  `v-if` uses the new `showDueDate` computed instead of `modelValue.dueDate`.
- `packages/app/tests/unit/invoiceDueDate.test.ts` (new): the truth table over
  all six statuses, missing/empty due dates, and an unknown status.
- `packages/api/src/kysely/seeds/demo.ts`: the backfill loop stamps a due date for
  numbered invoices only and writes an explicit `NULL` for unnumbered
  bill/receipt documents.
- `packages/api/tests/unit/banking/demo-seed.spec.ts`: the invariant is asserted
  on the seeded world (numbered → has a due date, unnumbered → none).
- `.changeset/show-invoice-deadline-only-when-open.md` (the app half only; the
  seeder is a dev fixture, so no changeset).

## Not touched, deliberately

- The dashboard's "vervalt op" lines: `getInvoiceOverdueAging` and
  `getUpcomingIncome` already filter `status = open` in SQL.
- Bank linking: `listLinkCandidates`/`getSuggestions` filter `open` as well, and
  `apply.ts`'s gate for bills is status-only, so it never reads a bill's due date.
- `paymentTermDays` on the bill form: it stays (it is the term the invoice email
  and PDF print), but nothing derives a date from it for bills.

## Verified

- Fresh throwaway Postgres + `migrate:latest` + `seed:demo`, then
  `group by status`: **bill 87 rows / 0 with a due date**, **receipt 63 / 0**,
  open 2 / 2, paid 31 / 31, canceled 17 / 17.
- `demo-seed.spec.ts` (DB-gated, run against that throwaway DB): 9 passed,
  including the new invariant. The spec truncates and re-seeds, so it exercises
  the seeder rather than the row I seeded by hand.
- App suite via the package's own runner (`vitrify test`): 11 files / 79 tests
  pass (4 new). `vue-tsc --noEmit -p tsconfig.json` exits 0, `oxlint src` and
  `oxfmt --check .` clean (only the pre-existing `src/tools.ts` warning).
