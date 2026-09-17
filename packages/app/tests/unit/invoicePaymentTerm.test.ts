import { describe, it, expect } from 'vitest'
import { InvoiceStatus } from '@slimfact/api/zod'
import { hasPaymentTerm } from '../../src/utils/invoice.js'

// The shared InvoiceForm hides the "Betalingstermijn in dagen" input when the
// document it edits has no payment term. BillsPage passes BILL; InvoicesPage and
// SubscriptionsPage pass nothing, because their documents are numbered by
// openInvoice, which turns the term into the due date.
describe('hasPaymentTerm', () => {
  it('asks for a term on invoices', () => {
    const invoiceStatuses = [
      InvoiceStatus.CONCEPT,
      InvoiceStatus.OPEN,
      InvoiceStatus.PAID,
      InvoiceStatus.CANCELED
    ]

    for (const status of invoiceStatuses) {
      expect(hasPaymentTerm(status), `status=${status}`).toBe(true)
    }
  })

  it('does not ask for one on bills or receipts', () => {
    const termless = [InvoiceStatus.BILL, InvoiceStatus.RECEIPT]

    for (const status of termless) {
      expect(hasPaymentTerm(status), `status=${status}`).toBe(false)
    }
  })

  it('defaults to asking when the status is unknown', () => {
    expect(hasPaymentTerm(undefined)).toBe(true)
    expect(hasPaymentTerm(null)).toBe(true)
  })
})
