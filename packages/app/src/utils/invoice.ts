import { InvoiceStatus } from '@slimfact/api/zod'

/**
 * Whether an invoice should display its payment deadline ("Vervalt op …").
 *
 * Only open invoices. The send/numbering handler stamps a due date on an
 * invoice that is already settled as well — it lands in `paid` with the same
 * `dueDate` (see `invoiceHandler`'s `addDays(new Date(), paymentTermDays)`) — so
 * a due date on its own is no reason to show a deadline that no longer applies.
 * Concepts, receipts and canceled invoices have no deadline to communicate
 * either, and a bill or receipt never carries one — the due date is an
 * invoice-only field, and `openInvoice` (its only writer) never runs for them.
 */
export const showsDueDate = (invoice: {
  status?: InvoiceStatus | null
  dueDate?: string | null
}) => invoice.status === InvoiceStatus.OPEN && !!invoice.dueDate

/**
 * Whether a document kind collects a payment term ("Betalingstermijn in
 * dagen").
 *
 * Invoices do: the term is what `openInvoice` turns into the due date when the
 * document is numbered. Bills and receipts never get there — `sendBill` and
 * `sendReceipt` only email the document — so asking for a term on them collects
 * a number that nothing reads back.
 */
export const hasPaymentTerm = (status?: InvoiceStatus | null) =>
  status !== InvoiceStatus.BILL && status !== InvoiceStatus.RECEIPT
