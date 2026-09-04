/**
 * Deterministic contract test for buildLinkProposal against the seeded demo
 * world. Verifies that every seeded transaction resolves to exactly the
 * expected proposal type — catching regressions in the matching engine.
 *
 * All inputs are crafted inline (no DB). The test mirrors the demo seed
 * world: invoices A–L (2026-0001..0012), transactions 001–010, payments
 * B (manual banktransfer), E (bank-linked + Mollie), J/K (Mollie
 * settlement 201), L (Mollie settlement 202).
 */
import { describe, it, expect } from 'vitest'
import {
  buildLinkProposal,
  findAdoptablePayment,
  matchSettlementForCredit
} from '../../../src/banking/match.js'
import type {
  BankPaymentCandidate,
  LinkProposal,
  MatchInvoice,
  MatchTransaction
} from '../../../src/banking/match.js'
import type { PspSettlement } from '../../../src/banking/client.js'
import { InvoiceStatus } from '@modular-api/fastify-checkout'

// ---------------------------------------------------------------------------
// Demo invoices A–L
// ---------------------------------------------------------------------------
const mkInvoice = (overrides: Partial<MatchInvoice>): MatchInvoice => ({
  id: 1,
  number: '2026-0001',
  amountDueCents: 5000,
  dueDate: '2026-07-01',
  status: InvoiceStatus.OPEN,
  companyId: 10,
  currency: 'EUR',
  ...overrides
})

const A = mkInvoice({ id: 1, number: '2026-0001', amountDueCents: 5000 })
const B = mkInvoice({
  id: 2,
  number: '2026-0002',
  amountDueCents: 3000,
  status: InvoiceStatus.PAID
})
const C = mkInvoice({ id: 3, number: '2026-0003', amountDueCents: 2500 })
const D = mkInvoice({ id: 4, number: '2026-0004', amountDueCents: 4000 })
const E = mkInvoice({
  id: 5,
  number: '2026-0005',
  amountDueCents: 4200,
  status: InvoiceStatus.PAID
})
const F = mkInvoice({ id: 6, number: '2026-0006', amountDueCents: 4000 })
const G = mkInvoice({ id: 7, number: '2026-0007', amountDueCents: 2499 })
const H = mkInvoice({ id: 8, number: '2026-0008', amountDueCents: 12900 })
const I = mkInvoice({ id: 9, number: '2026-0009', amountDueCents: 5900 })
const J = mkInvoice({
  id: 10,
  number: '2026-0010',
  amountDueCents: 34581,
  status: InvoiceStatus.PAID
})
const K = mkInvoice({
  id: 11,
  number: '2026-0011',
  amountDueCents: 1290,
  status: InvoiceStatus.PAID
})
const L = mkInvoice({
  id: 12,
  number: '2026-0012',
  amountDueCents: 19900,
  status: InvoiceStatus.PAID
})

const ALL_INVOICES = [A, B, C, D, E, F, G, H, I, J, K, L]

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
const mkPayment = (
  overrides: Partial<BankPaymentCandidate>
): BankPaymentCandidate => ({
  id: 900,
  invoiceId: null,
  amount: 5000,
  method: 'banktransfer',
  status: 'paid',
  transactionReference: null,
  externalId: null,
  settlementId: null,
  paymentServiceProvider: null,
  ...overrides
})

const manualPaymentB = mkPayment({
  id: 200,
  invoiceId: 2,
  amount: 3000,
  method: 'banktransfer',
  status: 'paid',
  transactionReference: null,
  externalId: null,
  settlementId: null,
  paymentServiceProvider: null
})

const molliePaymentE = mkPayment({
  id: 500,
  invoiceId: 5,
  amount: 4200,
  method: 'ideal',
  status: 'paid',
  transactionReference: 'bank:seed-credit-001',
  externalId: 'pay-seed-1',
  settlementId: 'setl-seed-001',
  paymentServiceProvider: 'mollie'
})

const molliePaymentJ = mkPayment({
  id: 1000,
  invoiceId: 10,
  amount: 34581,
  method: 'ideal',
  status: 'paid',
  transactionReference: 'bank:seed-credit-008',
  externalId: 'tr-201-1',
  settlementId: 'setl-seed-201',
  paymentServiceProvider: 'mollie'
})

const molliePaymentK = mkPayment({
  id: 1001,
  invoiceId: 11,
  amount: 1290,
  method: 'creditcard',
  status: 'paid',
  transactionReference: 'bank:seed-credit-008',
  externalId: 'tr-201-2',
  settlementId: 'setl-seed-201',
  paymentServiceProvider: 'mollie'
})

const molliePaymentL = mkPayment({
  id: 1002,
  invoiceId: 12,
  amount: 19900,
  method: 'ideal',
  status: 'paid',
  transactionReference: null,
  externalId: 'tr-202-1',
  settlementId: 'setl-seed-202',
  paymentServiceProvider: 'mollie'
})

const ALL_PAYMENTS = [
  manualPaymentB,
  molliePaymentE,
  molliePaymentJ,
  molliePaymentK,
  molliePaymentL
]

// ---------------------------------------------------------------------------
// PSP settlements / payments
// ---------------------------------------------------------------------------
const mkSettlement = (overrides: Partial<PspSettlement>): PspSettlement => ({
  externalId: 'setl-seed-001',
  psp: 'mollie',
  amountCents: 4200,
  feeCents: 0,
  currency: 'EUR',
  payoutDate: '2026-06-30',
  status: 'paidout',
  syncedAt: null,
  metadata: null,
  ...overrides
})

const setl001 = mkSettlement({
  externalId: 'setl-seed-001',
  amountCents: 4200,
  payoutDate: '2026-06-30'
})

const setl201 = mkSettlement({
  externalId: 'setl-seed-201',
  amountCents: 43373,
  payoutDate: '2026-06-30'
})

const setl202 = mkSettlement({
  externalId: 'setl-seed-202',
  amountCents: 32626,
  payoutDate: '2026-06-30'
})

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
const mkTx = (overrides: Partial<MatchTransaction>): MatchTransaction => ({
  externalId: 'txn-1',
  accountExternalId: 'acc-a',
  companyId: 10,
  amountCents: 5000,
  currency: 'EUR',
  creditDebit: 'CRDT',
  status: 'BOOK',
  bookingDate: '2026-06-30',
  transactionDate: null,
  description: null,
  remittanceInformation: null,
  referenceNumber: null,
  counterpartyName: null,
  counterpartyIban: null,
  ...overrides
})

const tx002 = mkTx({
  externalId: 'seed-credit-002',
  amountCents: 5000,
  description: 'FACTUUR 2026-0001'
})

const tx003 = mkTx({
  externalId: 'seed-credit-003',
  amountCents: 3000,
  description: 'FACTUUR 2026-0002'
})

const tx004 = mkTx({
  externalId: 'seed-credit-004',
  amountCents: 2500,
  description: 'FACTUUR 2026-0003'
})

const tx005 = mkTx({
  externalId: 'seed-credit-005',
  amountCents: 4500,
  description: 'FACTUUR 2026-0004'
})

const tx006 = mkTx({
  externalId: 'seed-credit-006',
  amountCents: 4200,
  description: 'MOLLIE PAYOUT',
  counterpartyName: 'Mollie B.V.',
  counterpartyIban: 'NL66MOLLIE0000000000'
})

const tx007 = mkTx({
  externalId: 'seed-credit-007',
  amountCents: 8000,
  description: null,
  remittanceInformation: null
})

const tx008 = mkTx({
  externalId: 'seed-credit-008',
  amountCents: 43373,
  description: 'MOLLIE SETTLEMENT 201',
  counterpartyName: 'Mollie B.V.',
  counterpartyIban: 'NL66MOLLIE0000000000'
})

const tx009 = mkTx({
  externalId: 'seed-credit-009',
  amountCents: 32626,
  description: 'MOLLIE SETTLEMENT 202',
  counterpartyName: 'Mollie B.V.',
  counterpartyIban: 'NL66MOLLIE0000000000'
})

const tx010 = mkTx({
  externalId: 'seed-credit-010',
  amountCents: 4500,
  description: 'FACTUUR 2026-0008'
})

// ---------------------------------------------------------------------------
// Proposal expectations
// ---------------------------------------------------------------------------
const proposal = (
  tx: MatchTransaction,
  invoices: MatchInvoice[] = ALL_INVOICES,
  payments: BankPaymentCandidate[] = ALL_PAYMENTS
): LinkProposal | null =>
  buildLinkProposal({
    transaction: tx,
    invoices,
    payments
  })

/** Read-time settlement recognition against the same demo world. */
const settlementFor = (
  tx: MatchTransaction,
  settlements: PspSettlement[] = [setl001, setl201, setl202]
): PspSettlement | null => matchSettlementForCredit(tx, settlements)

describe('buildLinkProposal against the seeded demo world', () => {
  it('002 → single A (strict exact match)', () => {
    const result = proposal(tx002)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('single')
    if (result!.type === 'single') {
      expect(result!.invoice.id).toBe(A.id)
    }
  })

  it('003 → adopt B (manual banktransfer adoption)', () => {
    const adoptable = findAdoptablePayment({
      transaction: tx003,
      payments: ALL_PAYMENTS.filter((p) => p.invoiceId === B.id)
    })
    expect(adoptable).not.toBeNull()
    expect(adoptable!.invoiceId).toBe(B.id)
  })

  it('004 → single C (strict exact match)', () => {
    const result = proposal(tx004)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('single')
    if (result!.type === 'single') {
      expect(result!.invoice.id).toBe(C.id)
    }
  })

  it('005 → split D (reference-priority)', () => {
    // Reference "FACTUUR 2026-0004" names exactly one open invoice (D) →
    // reference-priority split toward D, even though A+C would subset-sum.
    const result = proposal(tx005)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('split')
    if (result!.type === 'split') {
      expect(result!.invoice.id).toBe(D.id)
    }
  })

  it('007 → multi {D,F} (exact subset-sum)', () => {
    const result = proposal(tx007)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('multi')
    if (result!.type === 'multi') {
      const ids = result!.invoices.map((i) => i.id).sort()
      expect(ids).toEqual([D.id, F.id])
    }
  })

  it('006 → settlement setl-001 (Mollie payout recognized read-time)', () => {
    const matched = settlementFor(tx006)
    expect(matched).not.toBeNull()
    expect(matched!.externalId).toBe('setl-seed-001')
  })

  it('008 → settlement setl-201 (Mollie settlement 201)', () => {
    const matched = settlementFor(tx008)
    expect(matched).not.toBeNull()
    expect(matched!.externalId).toBe('setl-seed-201')
  })

  it('009 → settlement setl-202 (Mollie settlement 202)', () => {
    const matched = settlementFor(tx009)
    expect(matched).not.toBeNull()
    expect(matched!.externalId).toBe('setl-seed-202')
  })

  it('010 → split H (partial underpay: 45.00 vs 129.00)', () => {
    const result = proposal(tx010)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('split')
    if (result!.type === 'split') {
      expect(result!.invoice.id).toBe(H.id)
    }
  })
})
