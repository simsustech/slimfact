/**
 * Suggestion engine for bank credit → invoice matching.
 * SQL-derived suggestion scorer with deterministic gates + Fuse fuzzy client matching.
 */

import { containsInvoiceNumber, normalizeReference } from './normalize.js'
import { buildClientFuseIndex, fuzzyClientScore } from './client.js'
import type {
  MatchTransaction,
  MatchInvoice,
  BankPaymentCandidate,
  MatchConfig
} from './match.js'

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

/**
 * Finds an adoptable payment: exact-amount manual banktransfer payment.
 * Checks ALL invoices (not just open ones) because adoption applies to paid invoices.
 */
const findAdoptablePayment = (
  transaction: MatchTransaction,
  payments: BankPaymentCandidate[],
  invoices: MatchInvoice[]
): { payment: BankPaymentCandidate; invoice: MatchInvoice } | null => {
  for (const payment of payments) {
    if (
      payment.method === 'banktransfer' &&
      payment.status === 'paid' &&
      payment.invoiceId != null &&
      payment.amount === transaction.amountCents &&
      (payment.transactionReference === null ||
        payment.transactionReference === '' ||
        payment.transactionReference === transaction.bookingDate)
    ) {
      const invoice = invoices.find((inv) => inv.id === payment.invoiceId)
      if (invoice) {
        return { payment, invoice }
      }
    }
  }
  return null
}

/**
 * Main suggestion function for a single bank credit.
 * Returns null if no actionable suggestion exists.
 */
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
  const adoptable = findAdoptablePayment(transaction, payments, invoices)
  if (adoptable) {
    return {
      invoiceId: adoptable.invoice.id,
      score: 1.0,
      evidence: {
        numRefHit: false,
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
