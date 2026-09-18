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

/**
 * The invoicing details without their id: the payload the invoice forms submit.
 *
 * `companyId`/`clientId` are the link to the SlimFact record; `companyDetails`/
 * `clientDetails` are the invoicing details printed on the document, which may
 * carry no id at all and must equal the link when they do. The create/update
 * procedures take the stored key *from* a details id when no key is given, so a
 * details id in the payload *is* the link — submitting a stale one (an edited
 * document whose client was cleared) would relink the document to the client it
 * was just unlinked from. Dropping it is always correct: with a key present the
 * procedures rebuild the details from the record anyway.
 */
export const withoutDetailsId = <
  T extends {
    companyDetails?: { id?: number } | null
    clientDetails?: { id?: number } | null
  }
>(
  invoice: T
) => ({
  ...invoice,
  companyDetails: withoutId(invoice.companyDetails),
  clientDetails: withoutId(invoice.clientDetails)
})

const withoutId = <T extends { id?: number }>(details: T | null | undefined) =>
  details ? { ...details, id: undefined } : details
