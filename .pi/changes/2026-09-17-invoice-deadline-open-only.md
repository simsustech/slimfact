# 2026-09-17 — "Vervalt op …" only for open invoices

## Why

The invoice list showed a payment deadline (`lang.invoice.labels.dueBy`) on every
invoice that carried a `dueDate`, regardless of status. The send/numbering
handler stamps the due date on invoices that are already settled too: it sets
`status: InvoiceStatus.OPEN` when an amount is still due, otherwise
`InvoiceStatus.PAID`, and writes `dueDate` either way — so a paid invoice kept
advertising a deadline that no longer applied.

## What changed

- `packages/app/src/utils/invoice.ts` (new): `showsDueDate(invoice)` — open
  status plus a due date.
- `packages/app/src/components/invoice/InvoiceExpansionItem.vue`: the caption's
  `v-if` uses the new `showDueDate` computed instead of `modelValue.dueDate`.
- `packages/app/tests/unit/invoiceDueDate.test.ts` (new): the truth table over
  all six statuses, missing/empty due dates, and an unknown status.
- `.changeset/show-invoice-deadline-only-when-open.md`.

## Not touched

- The dashboard's "vervalt op" lines: `getInvoiceOverdueAging` and
  `getUpcomingIncome` already filter `status = open` in SQL, so those were
  correct.
- Bills and receipts: the UI has no due-date field, and the send path only runs
  for invoices, so a bill/receipt row never had a `dueDate` to display.

## Verified

- App suite via the package's own runner (`vitrify test`): 11 files / 79 tests
  pass (4 new). `vue-tsc --noEmit -p tsconfig.json` exits 0, `oxlint src` and
  `oxfmt --check .` clean (only the pre-existing `src/tools.ts` warning).
