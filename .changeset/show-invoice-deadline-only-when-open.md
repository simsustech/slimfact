---
"@slimfact/app": patch
---

Show the "Vervalt op …" deadline on open invoices only, and stop asking bills
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
