import { InvoiceStatus } from '@slimfact/api/zod'

/**
 * Whether an invoice should display its payment deadline ("Vervalt op …").
 *
 * Only open invoices. The send/numbering handler stamps a due date on an
 * invoice that is already settled as well — it lands in `paid` with the same
 * `dueDate` (see `invoiceHandler`'s `addDays(new Date(), paymentTermDays)`) — so
 * a due date on its own is no reason to show a deadline that no longer applies.
 * Concepts, receipts and canceled invoices have no deadline to communicate
 * either; bills carry a due date only if one was set through the API.
 */
export const showsDueDate = (invoice: {
  status?: InvoiceStatus | null
  dueDate?: string | null
}) => invoice.status === InvoiceStatus.OPEN && !!invoice.dueDate
