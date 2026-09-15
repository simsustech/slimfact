import { describe, it, expect } from 'vitest'
import {
  canApply,
  DEFAULT_MATCH_CONFIG,
  findAdoptablePayment,
  buildLinkProposal,
  extractInvoiceUuid,
  resolvePspPaymentInvoiceId,
  matchSettlementForCredit
} from '@slimfact/tools/banking'
import type {
  BankPaymentCandidate,
  MatchInvoice,
  MatchTransaction
} from '@slimfact/tools/banking'
import type { PspSettlement } from '@slimfact/tools/banking'
import { InvoiceStatus } from '@modular-api/fastify-checkout'

const openInvoice = (overrides: Partial<MatchInvoice> = {}): MatchInvoice => ({
  id: 1,
  number: '2026-0001',
  amountDueCents: 5000,
  dueDate: '2026-07-01',
  status: InvoiceStatus.OPEN,
  companyId: 10,
  currency: 'EUR',
  ...overrides
})

const credit = (
  overrides: Partial<MatchTransaction> = {}
): MatchTransaction => ({
  externalId: 'txn-1',
  accountExternalId: 'acc-a',
  companyId: 10,
  amountCents: 5000,
  currency: 'EUR',
  creditDebit: 'CRDT',
  status: 'BOOK',
  bookingDate: '2026-06-30',
  transactionDate: null,
  description: 'Factuur 2026-0001',
  remittanceInformation: null,
  referenceNumber: null,
  counterpartyName: null,
  counterpartyIban: null,
  ...overrides
})

const manualPayment = (
  overrides: Partial<BankPaymentCandidate> = {}
): BankPaymentCandidate => ({
  id: 900,
  invoiceId: 1,
  amount: 5000,
  method: 'banktransfer',
  status: 'paid',
  transactionReference: null,
  externalId: null,
  settlementId: null,
  paymentServiceProvider: null,
  ...overrides
})

describe('findAdoptablePayment', () => {
  it('adopts an exact-amount paid banktransfer payment with no reference', () => {
    const payment = findAdoptablePayment({
      transaction: credit(),
      payments: [manualPayment()]
    })
    expect(payment?.id).toBe(900)
  })

  it('adopts when the payment reference equals the booking date', () => {
    const payment = findAdoptablePayment({
      transaction: credit(),
      payments: [manualPayment({ transactionReference: '2026-06-30' })]
    })
    expect(payment?.id).toBe(900)
  })

  it('adopts an empty-string reference (the POS flow stores "")', () => {
    const payment = findAdoptablePayment({
      transaction: credit(),
      payments: [manualPayment({ transactionReference: '' })]
    })
    expect(payment?.id).toBe(900)
  })

  it('adopts a non-bank bookkeeper reference (short or invoice-number ref)', () => {
    const payment = findAdoptablePayment({
      transaction: credit(),
      payments: [manualPayment({ transactionReference: 'Factuur 2026-0001' })]
    })
    expect(payment?.id).toBe(900)
  })

  it('does not adopt on an amount mismatch', () => {
    const payment = findAdoptablePayment({
      transaction: credit(),
      payments: [manualPayment({ amount: 4900 })]
    })
    expect(payment).toBeNull()
  })

  it('does not adopt non-banktransfer, unpaid, or unassigned payments', () => {
    expect(
      findAdoptablePayment({
        transaction: credit(),
        payments: [manualPayment({ method: 'ideal' })]
      })
    ).toBeNull()
    expect(
      findAdoptablePayment({
        transaction: credit(),
        payments: [manualPayment({ status: 'pending' })]
      })
    ).toBeNull()
    expect(
      findAdoptablePayment({
        transaction: credit(),
        payments: [manualPayment({ invoiceId: null })]
      })
    ).toBeNull()
  })
})

describe('canApply', () => {
  it('allows an unlinked credit against an open invoice of the same company', () => {
    const result = canApply({
      transaction: credit(),
      invoice: openInvoice()
    })
    expect(result).toEqual({ ok: true })
  })

  it('rejects when the transaction is already linked', () => {
    const result = canApply({
      transaction: credit(),
      invoice: openInvoice(),
      alreadyLinked: true
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('linked')
  })

  it('rejects when the invoice is not open', () => {
    const result = canApply({
      transaction: credit(),
      invoice: openInvoice({ status: InvoiceStatus.PAID })
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a wrong-company match', () => {
    const result = canApply({
      transaction: credit(),
      invoice: openInvoice({ companyId: 99 })
    })
    expect(result.ok).toBe(false)
  })

  it('rejects overpay (amount > amountDue)', () => {
    const result = canApply({
      transaction: credit({ amountCents: 6000 }),
      invoice: openInvoice()
    })
    expect(result.ok).toBe(false)
  })

  it('rejects when the invoice has no amount due', () => {
    const result = canApply({
      transaction: credit(),
      invoice: openInvoice({ amountDueCents: 0 })
    })
    expect(result.ok).toBe(false)
  })
})

describe('buildLinkProposal', () => {
  it('returns single for an exact strict match', () => {
    const proposal = buildLinkProposal({
      transaction: credit(),
      invoices: [openInvoice()],
      payments: []
    })

    expect(proposal).toMatchObject({
      type: 'single',
      amountCents: 5000
    })
    if (proposal?.type === 'single') {
      expect(proposal.invoice.id).toBe(1)
    }
  })

  it('returns multi when two invoices sum to the credit amount', () => {
    const proposal = buildLinkProposal({
      transaction: credit({ amountCents: 5000 }),
      invoices: [
        openInvoice({ id: 1, amountDueCents: 3000, dueDate: null }),
        openInvoice({ id: 2, amountDueCents: 2000, dueDate: null })
      ],
      payments: []
    })

    expect(proposal).toMatchObject({ type: 'multi', totalCents: 5000 })
    if (proposal?.type === 'multi') {
      expect(proposal.invoices.map((invoice) => invoice.id).sort()).toEqual([
        1, 2
      ])
    }
  })

  it('returns split toward the referenced invoice over a subset-sum multi (reference-priority)', () => {
    const result = buildLinkProposal({
      transaction: credit({
        amountCents: 7500,
        description: 'Factuur 2026-0004'
      }),
      invoices: [
        openInvoice({ id: 4, number: '2026-0004', amountDueCents: 4000 }),
        openInvoice({ id: 1, number: '2026-0001', amountDueCents: 5000 }),
        openInvoice({ id: 3, number: '2026-0003', amountDueCents: 2500 })
      ],
      payments: []
    })
    expect(result).toMatchObject({ type: 'split' })
    if (result?.type === 'split') {
      expect(result.invoice.id).toBe(4)
    }
  })

  it('returns split when no exact sum but one invoice partially matches', () => {
    const proposal = buildLinkProposal({
      transaction: credit({ amountCents: 4500 }),
      invoices: [openInvoice({ amountDueCents: 5000 })],
      payments: []
    })

    expect(proposal).toMatchObject({
      type: 'split',
      partialAmountCents: 4500,
      invoiceAmountDueCents: 5000,
      otherCoverageCents: 500
    })
  })

  it('falls through to single when a PSP hint exists but nothing else matches', () => {
    const proposal = buildLinkProposal({
      transaction: credit({ counterpartyName: 'Mollie B.V.' }),
      invoices: [openInvoice()],
      payments: []
    })

    expect(proposal).toMatchObject({ type: 'single' })
  })
})

describe('matchSettlementForCredit', () => {
  const settlement = (
    overrides: Partial<PspSettlement> = {}
  ): PspSettlement => ({
    externalId: 'setl-m1',
    psp: 'mollie' as const,
    amountCents: 4950,
    feeCents: 50,
    currency: 'EUR',
    payoutDate: '2026-07-02',
    status: 'paidout',
    syncedAt: new Date('2026-07-03T00:00:00Z'),
    metadata: null,
    ...overrides
  })

  it('matches an exact amount + currency + date-in-window credit', () => {
    const matched = matchSettlementForCredit(
      credit({ amountCents: 4950, description: null }),
      [settlement()]
    )

    expect(matched?.externalId).toBe('setl-m1')
  })

  it('does not match when the booking date is outside the window', () => {
    const matched = matchSettlementForCredit(
      credit({
        amountCents: 4950,
        description: null,
        bookingDate: '2026-07-20'
      }),
      [settlement()]
    )

    expect(matched).toBeNull()
  })

  it('does not match a different currency', () => {
    const matched = matchSettlementForCredit(
      credit({ amountCents: 4950, description: null }),
      [settlement({ currency: 'USD' })]
    )

    expect(matched).toBeNull()
  })

  it('fee case: PSP hint with a unique net-mismatch candidate still matches', () => {
    const matched = matchSettlementForCredit(
      credit({
        amountCents: 32626,
        description: 'MOLLIE SETTLEMENT 202',
        bookingDate: '2026-08-23'
      }),
      [
        settlement({
          externalId: 'setl-big',
          amountCents: 33000,
          feeCents: 374,
          payoutDate: '2026-08-22'
        })
      ]
    )

    expect(matched?.externalId).toBe('setl-big')
  })

  it('fee case: two hint candidates in window -> no guess', () => {
    const matched = matchSettlementForCredit(
      credit({
        amountCents: 32626,
        description: 'MOLLIE SETTLEMENT 202',
        bookingDate: '2026-08-23'
      }),
      [
        settlement({ externalId: 'setl-a', payoutDate: '2026-08-20' }),
        settlement({ externalId: 'setl-b', payoutDate: '2026-08-25' })
      ]
    )

    expect(matched).toBeNull()
  })

  it('exact-tier ambiguity picks the closest payout date, tie-break lowest externalId', () => {
    const closest = matchSettlementForCredit(
      credit({ amountCents: 4950, description: null }),
      [
        settlement({ externalId: 'setl-far', payoutDate: '2026-06-25' }),
        settlement({ externalId: 'setl-near', payoutDate: '2026-07-03' })
      ]
    )
    expect(closest?.externalId).toBe('setl-near')

    const tie = matchSettlementForCredit(
      credit({ amountCents: 4950, description: null }),
      [
        settlement({ externalId: 'setl-zzz', payoutDate: '2026-07-02' }),
        settlement({ externalId: 'setl-aaa', payoutDate: '2026-07-02' })
      ]
    )
    expect(tie?.externalId).toBe('setl-aaa')
  })

  it('never matches a debit transaction', () => {
    const matched = matchSettlementForCredit(
      credit({ amountCents: 4950, description: null, creditDebit: 'DBIT' }),
      [settlement()]
    )

    expect(matched).toBeNull()
  })

  it('ignores settlements that never paid out (failed decoys)', () => {
    // Mirrors the seeded setl-seed-203: exact amount/date lookalike whose
    // money never moved.
    const matched = matchSettlementForCredit(
      credit({ amountCents: 3000, description: 'FACTUUR 2026-0002' }),
      [settlement({ status: 'failed', amountCents: 3000 })]
    )

    expect(matched).toBeNull()
  })

  it('one-to-one consumption: a consumed settlement is excluded by the caller', () => {
    const first = matchSettlementForCredit(
      credit({ amountCents: 4950, description: null }),
      [settlement()]
    )
    expect(first).not.toBeNull()

    const remaining = [settlement()].filter(
      (candidate) => candidate.externalId !== first!.externalId
    )
    const second = matchSettlementForCredit(
      credit({ amountCents: 4950, description: null }),
      remaining
    )

    expect(second).toBeNull()
  })
})

describe('PSP payment → invoice resolution', () => {
  it('extractInvoiceUuid finds a plain uuid and a localized label', () => {
    expect(extractInvoiceUuid('7ca67d1b-0f9a-47b1-800b-49b8ba0411f9')).toBe(
      '7ca67d1b-0f9a-47b1-800b-49b8ba0411f9'
    )
    expect(
      extractInvoiceUuid('Factuur 7ca67d1b-0f9a-47b1-800b-49b8ba0411f9')
    ).toBe('7ca67d1b-0f9a-47b1-800b-49b8ba0411f9')
    expect(extractInvoiceUuid('MOLLIE PAYOUT')).toBeNull()
  })

  it('resolves via the checkout.payments external-id seam first', () => {
    const byExternalId = new Map([['tr_123', { invoiceId: 42 }]])
    expect(
      resolvePspPaymentInvoiceId(
        { externalId: 'tr_123', description: 'MOLLIE PAYOUT' },
        byExternalId,
        new Map()
      )
    ).toBe(42)
  })

  it('falls back to the invoice uuid in the description', () => {
    const uuid = '7ca67d1b-0f9a-47b1-800b-49b8ba0411f9'
    expect(
      resolvePspPaymentInvoiceId(
        { externalId: 'unmapped-id', description: `Factuur ${uuid}` },
        new Map(),
        new Map([[uuid, 7]])
      )
    ).toBe(7)
  })

  it('returns null when neither seam resolves', () => {
    expect(
      resolvePspPaymentInvoiceId(
        { externalId: 'x', description: 'MOLLIE PAYOUT' },
        new Map(),
        new Map()
      )
    ).toBeNull()
  })
})
