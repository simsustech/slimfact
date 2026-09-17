---
"@slimfact/app": patch
---

Show the "Vervalt op …" deadline on open invoices only.

The caption rendered whenever an invoice carried a due date, but the send
handler stamps one on invoices that are already settled as well — it sets the
status to `paid` and writes the same `dueDate` — so a paid invoice kept
advertising a payment deadline in the invoice list.

The rule now lives in `src/utils/invoice.ts` (`showsDueDate`) and is covered by
a unit test over every invoice status.
