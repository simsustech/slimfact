import { describe, it, expect } from 'vitest'
import { detailsLinkMismatch } from '../../src/zod/invoice.js'

// `companyId`/`clientId` are the link to the SlimFact record; `companyDetails` and
// `clientDetails` are the invoicing details printed on the document. When both
// sides are present they must agree — the create/update procedures rebuild the
// details from the record whenever a link is given, so a disagreeing details id is
// stale input. A missing half is not a contradiction (the key then comes from the
// details, which is how a details-only payload gets linked at all).
describe('detailsLinkMismatch', () => {
  it('accepts matching pairs', () => {
    expect(
      detailsLinkMismatch({
        clientId: 9,
        clientDetails: { id: 9 },
        companyId: 3,
        companyDetails: { id: 3 }
      })
    ).toBeNull()
  })

  it('accepts a missing half, either way', () => {
    // Details-only payload: the procedures take the key from the details.
    expect(detailsLinkMismatch({ clientDetails: { id: 9 } })).toBeNull()
    // Key without details id: the unlinked document.
    expect(
      detailsLinkMismatch({ clientId: null, clientDetails: { id: undefined } })
    ).toBeNull()
    expect(
      detailsLinkMismatch({ clientId: 9, clientDetails: undefined })
    ).toBeNull()
  })

  it('reports a disagreeing client', () => {
    expect(detailsLinkMismatch({ clientId: 9, clientDetails: { id: 5 } })).toBe(
      'clientId (9) does not match clientDetails.id (5)'
    )
  })

  it('reports a disagreeing company', () => {
    expect(
      detailsLinkMismatch({ companyId: 1, companyDetails: { id: 2 } })
    ).toBe('companyId (1) does not match companyDetails.id (2)')
  })

  it('checks the client first when both disagree', () => {
    expect(
      detailsLinkMismatch({
        clientId: 9,
        clientDetails: { id: 5 },
        companyId: 1,
        companyDetails: { id: 2 }
      })
    ).toBe('clientId (9) does not match clientDetails.id (5)')
  })

  it('treats a null link as absent, not as a mismatch', () => {
    expect(
      detailsLinkMismatch({ clientId: null, clientDetails: { id: 5 } })
    ).toBeNull()
  })
})
