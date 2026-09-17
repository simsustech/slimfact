import { describe, it, expect } from 'vitest'
import { InvoiceStatus } from '@slimfact/api/zod'
import { showsDueDate } from '../../src/utils/invoice.js'

// The "Vervalt op …" caption used to render on every invoice carrying a due
// date, so an invoice that was sent and already settled (the send handler
// stamps a due date and then lands the invoice in `paid`) still advertised a
// deadline.
describe('showsDueDate', () => {
  it('shows the deadline on an open invoice', () => {
    expect(
      showsDueDate({ status: InvoiceStatus.OPEN, dueDate: '2026-01-31' })
    ).toBe(true)
  })

  it('hides it for every status that is not open', () => {
    const notOpen = [
      InvoiceStatus.PAID,
      InvoiceStatus.CONCEPT,
      InvoiceStatus.RECEIPT,
      InvoiceStatus.BILL,
      InvoiceStatus.CANCELED
    ]

    for (const status of notOpen) {
      expect(
        showsDueDate({ status, dueDate: '2026-01-31' }),
        `status=${status}`
      ).toBe(false)
    }
  })

  it('hides it when the invoice has no due date', () => {
    expect(showsDueDate({ status: InvoiceStatus.OPEN })).toBe(false)
    expect(showsDueDate({ status: InvoiceStatus.OPEN, dueDate: null })).toBe(
      false
    )
    expect(showsDueDate({ status: InvoiceStatus.OPEN, dueDate: '' })).toBe(
      false
    )
  })

  it('hides it when the status is unknown', () => {
    expect(showsDueDate({ dueDate: '2026-01-31' })).toBe(false)
    expect(showsDueDate({ status: null, dueDate: '2026-01-31' })).toBe(false)
  })
})
