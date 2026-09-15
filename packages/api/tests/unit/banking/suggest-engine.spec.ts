import { describe, expect, it } from 'vitest'
import { suggestForCredit } from '@slimfact/tools/banking/suggest'
import type {
  MatchTransaction,
  MatchInvoice,
  BankPaymentCandidate
} from '@slimfact/tools/banking'

/**
 * Synthetic fixtures for the suggestion engine.
 * Tests deterministic gates + Fuse fuzzy client matching.
 */

const makeInvoice = (overrides: Partial<MatchInvoice> = {}): MatchInvoice => ({
  id: 1,
  number: 'INV-2026-001',
  amountDueCents: 10000,
  dueDate: '2026-09-01',
  status: 'open' as any,
  companyId: 1,
  currency: 'EUR',
  ...overrides
})

const makeTransaction = (
  overrides: Partial<MatchTransaction> = {}
): MatchTransaction => ({
  externalId: 'tx-001',
  accountExternalId: 'acc-001',
  companyId: 1,
  amountCents: 10000,
  currency: 'EUR',
  creditDebit: 'CRDT',
  status: 'BOOK',
  bookingDate: '2026-09-03',
  transactionDate: null,
  description: 'Payment for INV-2026-001',
  remittanceInformation: null,
  referenceNumber: null,
  counterpartyName: 'Acme Corp',
  counterpartyIban: null,
  ...overrides
})

const makePayment = (
  overrides: Partial<BankPaymentCandidate> = {}
): BankPaymentCandidate => ({
  id: 1,
  invoiceId: 1,
  amount: 10000,
  method: 'banktransfer',
  status: 'paid',
  transactionReference: null,
  externalId: null,
  settlementId: null,
  paymentServiceProvider: null,
  ...overrides
})

const defaultConfig = { referenceWindowDays: 14 }

describe('suggestForCredit', () => {
  describe('deterministic gates', () => {
    it('rejects when amount exceeds invoice total (no overpay)', () => {
      const transaction = makeTransaction({ amountCents: 15000 })
      const invoices = [makeInvoice({ amountDueCents: 10000 })]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments: [],
        config: defaultConfig
      })

      expect(result).toBeNull()
    })

    it('allows partial amount (amount <= total)', () => {
      const transaction = makeTransaction({ amountCents: 5000 })
      const invoices = [makeInvoice({ amountDueCents: 10000 })]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments: [],
        config: defaultConfig
      })

      expect(result).not.toBeNull()
      expect(result!.invoiceId).toBe(1)
    })

    it('rejects when booking date is before invoice date', () => {
      const transaction = makeTransaction({ bookingDate: '2026-08-01' })
      const invoices = [makeInvoice({ dueDate: '2026-09-01' })]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments: [],
        config: defaultConfig
      })

      expect(result).toBeNull()
    })

    it('rejects when amount does not match exactly for strict match', () => {
      const transaction = makeTransaction({ amountCents: 9500 })
      const invoices = [makeInvoice({ amountDueCents: 10000 })]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments: [],
        config: defaultConfig
      })

      // Should still return a suggestion (low confidence), but not strict
      expect(result).not.toBeNull()
      expect(result!.score).toBeLessThan(1.0)
    })
  })

  describe('invoice number reference hit', () => {
    it('returns high score when invoice number is in transaction reference', () => {
      const transaction = makeTransaction({
        description: 'Payment for INV-2026-001',
        amountCents: 10000
      })
      const invoices = [
        makeInvoice({ number: 'INV-2026-001', amountDueCents: 10000 })
      ]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments: [],
        config: defaultConfig
      })

      expect(result).not.toBeNull()
      expect(result!.invoiceId).toBe(1)
      expect(result!.evidence.numRefHit).toBe(true)
    })

    it('detects invoice number in remittance information', () => {
      const transaction = makeTransaction({
        description: null,
        remittanceInformation: 'Ref: 20260001',
        amountCents: 10000
      })
      const invoices = [
        makeInvoice({ number: '2026-0001', amountDueCents: 10000 })
      ]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments: [],
        config: defaultConfig
      })

      expect(result).not.toBeNull()
      expect(result!.evidence.numRefHit).toBe(true)
    })
  })

  describe('fuzzy client matching via Fuse', () => {
    it('matches when client name is a fuzzy variant', () => {
      const transaction = makeTransaction({
        counterpartyName: 'Acme Corporation',
        description: 'Bank transfer',
        amountCents: 10000
      })
      const invoices = [
        makeInvoice({
          id: 1,
          number: 'INV-2026-001',
          amountDueCents: 10000,
          companyId: 1
        })
      ]

      // Mock client data for fuzzy matching
      const clientData = [{ companyId: 1, clientCompany: 'Acme Corp' }]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments: [],
        config: defaultConfig,
        clientData
      })

      expect(result).not.toBeNull()
      expect(result!.invoiceId).toBe(1)
      expect(result!.evidence.clientScore).toBeGreaterThan(0)
    })

    it('rejects when client name is too dissimilar', () => {
      const transaction = makeTransaction({
        counterpartyName: 'Totally Different Company',
        description: 'Bank transfer',
        amountCents: 10000
      })
      const invoices = [
        makeInvoice({
          id: 1,
          number: 'INV-2026-001',
          amountDueCents: 10000,
          companyId: 1
        })
      ]

      const clientData = [{ companyId: 1, clientCompany: 'Acme Corp' }]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments: [],
        config: defaultConfig,
        clientData
      })

      expect(result).toBeNull()
    })
  })

  describe('adoption', () => {
    it('suggests adoption when exact-amount manual banktransfer payment exists', () => {
      const transaction = makeTransaction({ amountCents: 10000 })
      const invoices = [
        makeInvoice({ id: 1, status: 'paid' as any, amountDueCents: 0 })
      ]
      const payments = [
        makePayment({
          id: 1,
          invoiceId: 1,
          amount: 10000,
          method: 'banktransfer',
          status: 'paid',
          transactionReference: null
        })
      ]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments,
        config: defaultConfig
      })

      expect(result).not.toBeNull()
      expect(result!.invoiceId).toBe(1)
      expect(result!.evidence.adoptablePaymentId).toBe(1)
      // Default fixture has an invoice-number ref → near-certain adoption.
      expect(result!.evidence.numRefHit).toBe(true)
      expect(result!.score).toBeCloseTo(0.98)
    })

    it('rejects adoption when amount matches but client does not', () => {
      // A €50 credit from Jolanda Aukes must NOT adopt a €50 manual payment
      // on Ruud van Eggelen's invoice — amount alone is never enough.
      const transaction = makeTransaction({
        amountCents: 5000,
        counterpartyName: 'Jolanda Aukes',
        description: 'Trimmen pippa',
        remittanceInformation: null
      })
      const invoices = [
        makeInvoice({
          id: 1,
          status: 'paid' as any,
          amountDueCents: 0,
          clientName: 'Ruud van Eggelen'
        })
      ]
      const payments = [
        makePayment({
          id: 1,
          invoiceId: 1,
          amount: 5000,
          transactionReference: null
        })
      ]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments,
        config: defaultConfig
      })

      expect(result).toBeNull()
    })

    it('adopts when the payer surname matches the invoice client', () => {
      // Initial-prefixed payer ("Hr M Groenewegen, Mw C Mendez Cabrera")
      // shares the surname with invoice client "Marco Groenewegen".
      const transaction = makeTransaction({
        amountCents: 5000,
        counterpartyName: 'Hr M Groenewegen, Mw C Mendez Cabrera',
        description: 'Aanbetaling Leo, oktober 2026',
        remittanceInformation: null
      })
      const invoices = [
        makeInvoice({
          id: 1,
          status: 'paid' as any,
          amountDueCents: 0,
          clientName: 'Marco Groenewegen'
        })
      ]
      const payments = [
        makePayment({
          id: 1,
          invoiceId: 1,
          amount: 5000,
          transactionReference: null
        })
      ]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments,
        config: defaultConfig
      })

      expect(result).not.toBeNull()
      expect(result!.invoiceId).toBe(1)
      // Surname-only tie (no invoice-number ref) → strong but inferred.
      expect(result!.evidence.numRefHit).toBe(false)
      expect(result!.score).toBeCloseTo(0.75)
    })

    it('prefers the invoice the credit explicitly references over an earlier same-client one', () => {
      // Two €130 manual payments on two paid invoices of the same client.
      // The credit references HVB-2026-4 → adoption must pick invoice 4's
      // payment, not the first same-amount/same-client payment (invoice 2).
      const transaction = makeTransaction({
        amountCents: 13000,
        counterpartyName: 'V.d. Bighelaar Elektrotechniek B.V.',
        description: null,
        remittanceInformation: 'HVB-2026-4',
        referenceNumber: null
      })
      const invoices = [
        makeInvoice({
          id: 2,
          number: 'HVB-2026-2',
          status: 'paid' as any,
          amountDueCents: 0,
          clientName: 'Van den Bighelaar Elektrotechniek'
        }),
        makeInvoice({
          id: 4,
          number: 'HVB-2026-4',
          status: 'paid' as any,
          amountDueCents: 0,
          clientName: 'Van den Bighelaar Elektrotechniek'
        })
      ]
      const payments = [
        makePayment({
          id: 11,
          invoiceId: 2,
          amount: 13000,
          transactionReference: '14-4'
        }),
        makePayment({
          id: 12,
          invoiceId: 4,
          amount: 13000,
          transactionReference: '29-6'
        })
      ]

      const result = suggestForCredit({
        transaction,
        invoices,
        payments,
        config: defaultConfig
      })

      expect(result).not.toBeNull()
      expect(result!.invoiceId).toBe(4)
      expect(result!.evidence.adoptablePaymentId).toBe(12)
      // Explicit ref → near-certain.
      expect(result!.evidence.numRefHit).toBe(true)
      expect(result!.score).toBeCloseTo(0.98)
    })
  })
})
