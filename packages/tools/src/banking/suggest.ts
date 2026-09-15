/**
 * Suggestion engine for bank credit → invoice matching.
 * SQL-derived suggestion scorer with deterministic gates + Fuse fuzzy client matching.
 */

import { findAdoptablePayment } from './match.js'
import { containsInvoiceNumber, normalizeReference } from './normalize.js'
import {
  buildClientFuseIndex,
  fuzzyClientScore,
  sharedSurnameToken
} from './client.js'
import type {
  MatchTransaction,
  MatchInvoice,
  BankPaymentCandidate,
  MatchConfig
} from './types.js'

interface AdoptableHit {
  payment: BankPaymentCandidate
  invoice: MatchInvoice
  numRefHit: boolean
}

/**
 * Best adoption candidate across the company's invoices, using the shared
 * match.ts predicate for the payment itself and layering the suggestion
 * rules on top: an explicit invoice-number reference in the credit text is
 * preferred (and sufficient); otherwise a client surname tie is required —
 * amount equality is never enough on its own.
 */
const findAdoptableCandidate = (
  transaction: MatchTransaction,
  payments: BankPaymentCandidate[],
  invoices: MatchInvoice[]
): AdoptableHit | null => {
  const creditText = normalizeReference(
    [
      transaction.description,
      transaction.remittanceInformation,
      transaction.referenceNumber
    ]
      .filter((part): part is string => !!part)
      .join(' ')
  )
  const payer = transaction.counterpartyName ?? ''
  let refFallback: AdoptableHit | null = null
  for (const payment of payments) {
    if (!findAdoptablePayment({ transaction, payments: [payment] })) continue
    const invoice = invoices.find((inv) => inv.id === payment.invoiceId)
    if (!invoice) continue
    const numRefHit =
      !!invoice.number &&
      containsInvoiceNumber(normalizeReference(creditText), invoice.number)
    const clientTie = sharedSurnameToken(payer, invoice.clientName)
    if (!clientTie && !numRefHit) continue
    if (numRefHit) return { payment, invoice, numRefHit: true }
    if (!refFallback) refFallback = { payment, invoice, numRefHit: false }
  }
  return refFallback
}

export interface SuggestInput {
  transaction: MatchTransaction
  invoices: MatchInvoice[]
  payments: BankPaymentCandidate[]
  config: MatchConfig
  clientData?: Array<{ companyId: number; clientCompany: string }>
}

export interface SuggestResult {
  invoiceId: number
  score: number
  evidence: {
    numRefHit: boolean
    clientScore: number
    adoptablePaymentId: number | null
  }
}

export const suggestForCredit = ({
  transaction,
  invoices,
  payments,
  config: _config,
  clientData = []
}: SuggestInput): SuggestResult | null => {
  // Gate 1: Only process booked credits
  if (transaction.creditDebit !== 'CRDT' || transaction.status !== 'BOOK') {
    return null
  }

  // Gate 2: Check for adoptable payment FIRST — adoption applies to paid
  // invoices (amountDueCents may be 0), so it must run before the
  // no-overpay / date-valid filters that exclude paid invoices.
  const adoptable = findAdoptableCandidate(transaction, payments, invoices)
  if (adoptable) {
    // Graded confidence for adoption: an explicit invoice-number reference
    // in the credit text is near-certain; a client-surname-only tie is a
    // strong but inferred match (same client paid some same-amount invoice).
    const score = adoptable.numRefHit ? 0.98 : 0.75
    return {
      invoiceId: adoptable.invoice.id,
      score,
      evidence: {
        numRefHit: adoptable.numRefHit,
        clientScore: 0,
        adoptablePaymentId: adoptable.payment.id
      }
    }
  }

  // Gate 3: Amount must not exceed invoice total (no overpay)
  const validInvoices = invoices.filter(
    (inv) => transaction.amountCents <= inv.amountDueCents
  )
  if (validInvoices.length === 0) {
    return null
  }

  // Gate 4: Date guard - booking date must be >= invoice date
  const dateValidInvoices = validInvoices.filter((inv) => {
    if (!transaction.bookingDate || !inv.dueDate) return false
    return new Date(transaction.bookingDate) >= new Date(inv.dueDate)
  })
  if (dateValidInvoices.length === 0) {
    return null
  }

  // Gate 5: Check invoice number reference hit
  const reference = [
    transaction.description,
    transaction.remittanceInformation,
    transaction.referenceNumber
  ]
    .filter((part): part is string => !!part)
    .join(' ')

  const numRefHit = dateValidInvoices.some(
    (inv) =>
      inv.number &&
      containsInvoiceNumber(normalizeReference(reference), inv.number)
  )

  // Gate 6: Fuzzy client matching via client module
  let clientScore = 0
  if (clientData.length > 0 && transaction.counterpartyName) {
    const fuse = buildClientFuseIndex(clientData)
    clientScore = fuzzyClientScore(
      transaction.counterpartyName,
      fuse,
      transaction.companyId
    )
  }

  // If no reference hit and no client match, no suggestion
  if (!numRefHit && clientScore === 0) {
    return null
  }

  // Find best matching invoice
  let bestInvoice: MatchInvoice | null = null
  let bestScore = 0

  for (const invoice of dateValidInvoices) {
    let score = 0

    // Reference hit gives high score
    if (
      numRefHit &&
      invoice.number &&
      containsInvoiceNumber(normalizeReference(reference), invoice.number)
    ) {
      score += 0.7
    }

    // Client match gives moderate score
    if (clientScore > 0) {
      score += clientScore * 0.3
    }

    // Exact amount match boosts score
    if (transaction.amountCents === invoice.amountDueCents) {
      score += 0.2
    }

    if (score > bestScore) {
      bestScore = score
      bestInvoice = invoice
    }
  }

  if (!bestInvoice || bestScore === 0) {
    return null
  }

  return {
    invoiceId: bestInvoice.id,
    score: Math.min(bestScore, 1.0),
    evidence: {
      numRefHit,
      clientScore,
      adoptablePaymentId: null
    }
  }
}

/**
 * Per-candidate invoice score for the link dialog. Mirrors the adoption and
 * open-invoice scoring used by suggestForCredit, but returns a score for
 * EVERY actionable candidate (not just the best) so the UI can sort and
 * label them.
 */
export const scoreInvoiceCandidates = ({
  transaction,
  invoices,
  payments
}: {
  transaction: MatchTransaction
  invoices: MatchInvoice[]
  payments: BankPaymentCandidate[]
}): Array<{ invoiceId: number; score: number; adoptable: boolean }> => {
  const out: Array<{ invoiceId: number; score: number; adoptable: boolean }> =
    []
  if (transaction.creditDebit !== 'CRDT' || transaction.status !== 'BOOK') {
    return out
  }
  const creditText = normalizeReference(
    [
      transaction.description,
      transaction.remittanceInformation,
      transaction.referenceNumber
    ]
      .filter((part): part is string => !!part)
      .join(' ')
  )
  const payer = transaction.counterpartyName ?? ''

  // Score every adoptable paid invoice (manual banktransfer payment, not
  // bank-coupled, exact amount) that also has a client tie or a ref hit —
  // same rules as suggestForCredit's adoption gate.
  for (const payment of payments) {
    if (!findAdoptablePayment({ transaction, payments: [payment] })) continue
    const invoice = invoices.find((inv) => inv.id === payment.invoiceId)
    if (!invoice) continue
    const numRefHit =
      !!invoice.number &&
      containsInvoiceNumber(normalizeReference(creditText), invoice.number)
    const clientTie = sharedSurnameToken(payer, invoice.clientName)
    if (!clientTie && !numRefHit) continue
    out.push({
      invoiceId: invoice.id,
      score: numRefHit ? 0.98 : 0.75,
      adoptable: true
    })
  }

  // Score open invoices (remaining balance, no overpay, date guard).
  const openScores = invoices
    .filter(
      (inv) =>
        inv.status === 'open' &&
        inv.amountDueCents > 0 &&
        transaction.amountCents <= inv.amountDueCents
    )
    .map((inv) => {
      const numRefHit =
        !!inv.number &&
        containsInvoiceNumber(normalizeReference(creditText), inv.number)
      if (!numRefHit) return null
      const amountExact = transaction.amountCents === inv.amountDueCents
      const dateOk =
        !!transaction.bookingDate &&
        !!inv.dueDate &&
        new Date(transaction.bookingDate) >= new Date(inv.dueDate)
      const score = amountExact && dateOk ? 0.95 : 0.85
      return { invoiceId: inv.id, score, adoptable: false }
    })
    .filter(
      (c): c is { invoiceId: number; score: number; adoptable: boolean } =>
        c !== null
    )

  return [...out, ...openScores]
}
