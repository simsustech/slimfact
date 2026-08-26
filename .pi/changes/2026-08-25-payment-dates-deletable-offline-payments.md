# 2026-08-25 — InvoiceExpansionItem improvements: payment dates + deletable offline payments

## What changed

**Payment dates end-to-end**

- `packages/app/src/components/AddPaymentDialog.vue`: required `DateInput` (default today, DD-MM-YYYY) between amount and reference; OK validates the form first; emits `date`.
- `packages/api/src/trpc/admin/invoices.ts`: `addPaymentToInvoice` input accepts/forwards `date`; new `deletePaymentFromInvoice` mutation (calls handler, writes `paymentDeleted` invoice event).
- `packages/app/src/pages/admin/{Invoices,Bills}Page.vue`: pass picked date through; descriptions now `"Cash payment 25-08-2026"` style labels (replaces the ISO-in-description hack).
- `~/Projects/modular-api/fastify-checkout`: **bug fix** — bankTransfer handler destructured `date` but never wrote `paidAt`; bank-sync applies (`apply.ts`) now send `bookingDate ?? transactionDate` so synced payments are booked on the bank's posting date.
- `withPayments` select extended with `invoiceId` + `createdAt` (client needed both).

**Deletable offline payments (cash / bank transfer / PIN only)**

- New `invoiceHandler.deletePaymentFromInvoice` (guards: offline method, invoice OPEN/PAID, payment belongs to invoice); auto-reverts PAID → OPEN when amountDue > 0; logs warn.
- Upstream `PaymentItem.vue` (`modular-api/packages/components`): optional `onDeletePayment` prop → trash button on offline rows; paidAt display falls back to createdAt.
- Pages wire confirm dialog → mutation → refresh. Audit row in `invoice_events` (`PAYMENT_DELETED`).

**InvoiceExpansionItem cleanup/layout**

- ~90 lines of commented-out dead code removed; tab ref type widened; empty Lines/Discounts/Surcharges headers hidden; due-date caption ("Due by …") + red Overdue chip for open-past-due invoices; smart default tab = Payments when fully paid with payments.

**i18n**: new keys ×3 (date, confirmDeletePayment, descriptions.*, dueBy, overdue, paymentDeleted).
**Follow-up**: delete confirmation is now descriptive — `confirmDeletePayment({ method, number, amount })` renders e.g. "Are you sure you want to delete the Cash payment for invoice 2026.2 with the amount of €50.00?" (locale currency formatting; nl/de equivalents); pages resolve method label + invoice number from the list data.

**Tests**

- New unit spec `packages/api/tests/unit/payments.spec.ts` (6 DB-backed tests: delete guards, auto-revert, date→paidAt).
- apply.spec extended (bookingDate forwarding ×2).
- E2E: invoice-flow +2 tests (chosen date recorded; delete reverts PAID→OPEN), banking-review asserts synced paidAt == bookingDate.
- payments.spec lifecycle test de-flaked (newest-row targeting, role-based submenu selectors).

## Why

Admins need to see/correct when payments actually happened (manual entries previously had no date UI and couldn't be removed); bank-synced payments were stamped with sync time instead of booking date.

## Verification

Fresh stack full Playwright suite **33 passed / 0 failed / 8 skipped**; units **164/164**; format/lint/build clean.

## Notes

- fastify-checkout & modular-api components have local uncommitted changes → keep the four LINKED_* env vars exported for Docker builds (incl. `LINKED_MODULAR_API_QUASAR_COMPONENTS_PATH=~/Projects/modular-api/packages/components`, NOT `LINKED_QUASAR_COMPONENTS_PATH`, which is the simsustech form-components overlay).
- Evaluation: `.pi/plans/2026-08-25-improve-invoice-expansion-item.evaluation.md`.
