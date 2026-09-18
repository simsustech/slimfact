import { describe, it, expect } from 'vitest'
import { withoutDetailsId } from '../../src/utils/invoice.js'

// The payload the invoice forms submit. `companyId`/`clientId` are the link to the
// SlimFact records; `companyDetails`/`clientDetails` are the invoicing details
// printed on the document, which may carry no id at all and must equal the link
// when they do. The create/update procedures take the stored key *from* a details
// id, and reject a payload whose details id disagrees with a given key
// (`detailsLinkMismatch`), so the form never sends one.
describe('withoutDetailsId', () => {
  it('drops the ids from both details objects', () => {
    const payload = withoutDetailsId({
      clientId: 9,
      companyId: 3,
      clientDetails: { id: 9, companyName: 'Client BV' },
      companyDetails: { id: 3, name: 'Company BV' }
    })

    expect(payload.clientDetails).toEqual({
      id: undefined,
      companyName: 'Client BV'
    })
    expect(payload.companyDetails).toEqual({
      id: undefined,
      name: 'Company BV'
    })
  })

  it('keeps the foreign keys themselves', () => {
    const payload = withoutDetailsId({
      clientId: null,
      companyId: 3,
      clientDetails: { id: 9, companyName: 'Client BV' }
    })

    // The document is being unlinked: with the key gone and the details id gone,
    // nothing can restore the link the operator just removed.
    expect(payload.clientId).toBeNull()
    expect(payload.companyId).toBe(3)
  })

  it('leaves everything else untouched', () => {
    const invoice = {
      currency: 'EUR' as const,
      paymentTermDays: 14,
      lines: [{ description: 'E2E' }],
      metadata: { source: 'e2e' }
    }

    expect(withoutDetailsId(invoice)).toEqual(invoice)
  })

  it('keeps missing details missing', () => {
    const payload = withoutDetailsId({ clientId: 9, clientDetails: null })

    expect(payload.clientDetails).toBeNull()
    expect(payload.companyDetails).toBeUndefined()
  })
})
