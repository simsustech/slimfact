import { describe, expect, it } from 'vitest'
import {
  suggestForCredit,
  type SuggestInput
} from '@slimfact/tools/banking/suggest'
import type {
  MatchTransaction,
  MatchInvoice,
  BankPaymentCandidate
} from '@slimfact/tools/banking/match'

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
    })
  })
})
