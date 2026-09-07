/**
 * Shared matching logic for bank credit → invoice matching.
 * Ported from api/src/banking/match.ts — framework-free, lives in @slimfact/tools.
 */

import { containsInvoiceNumber, normalizeReference } from './normalize.js'
import type {
  MatchTransaction,
  MatchInvoice,
  BankPaymentCandidate,
  MatchConfig,
  PspSettlement
} from './types.js'

/** InvoiceStatus mirror — tools is framework-free, can't import from checkout. */
export const InvoiceStatus = { OPEN: 'open' } as const

export type MatchLevel = 'strict' | 'suggest' | 'none'

export interface MatchResult {
  level: MatchLevel
  invoiceId?: number
  reasons: string[]
}

type Confidence = 'strict' | 'medium' | 'low'

export interface Suggestion {
  invoiceId: number
  invoiceNumber: string | null
  confidence: Confidence
  reasons: string[]
  adopt?: boolean
}

interface ScoredCandidate extends Suggestion {
  invoice: MatchInvoice
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  referenceWindowDays: 14
}

const confidenceRank = (confidence: Confidence): number =>
  confidence === 'strict' ? 0 : confidence === 'medium' ? 1 : 2

/** Plain-TS date diff — replaces date-fns differenceInCalendarDays. */
const differenceInDays = (a: Date, b: Date): number => {
  const msPerDay = 86_400_000
  return Math.round((a.getTime() - b.getTime()) / msPerDay)
}

const inDateWindow = (
  bookingDate: string | null,
  dueDate: string | null,
  windowDays: number
): boolean => {
  if (!bookingDate || !dueDate) return false
  return (
    Math.abs(differenceInDays(new Date(bookingDate), new Date(dueDate))) <=
    windowDays
  )
}

/**
 * Adoption predicate: a paid manual banktransfer payment for the exact credit
 * amount can be coupled to the bank credit instead of creating a second
 * payment. Mirrors the SQL adopt anchor (NOT LIKE 'bank:%'): a ref may be
 * NULL, empty, the booking date, or a bookkeeper short ref ("29-6",
 * "Factuur 2026-1"). Only `bank:`-prefixed refs mark an already-coupled
 * payment and are excluded.
 *
 * Callers decide which invoice(s) to test; this checks the payment itself.
 */
export const findAdoptablePayment = ({
  transaction,
  payments
}: {
  transaction: MatchTransaction
  payments: BankPaymentCandidate[]
}): BankPaymentCandidate | null => {
  return (
    payments.find(
      (payment) =>
        payment.method === 'banktransfer' &&
        payment.status === 'paid' &&
        payment.invoiceId != null &&
        payment.amount === transaction.amountCents &&
        (payment.transactionReference === null ||
          payment.transactionReference === '' ||
          !payment.transactionReference.startsWith('bank:'))
    ) ?? null
  )
}

const scoreCandidate = (
  transaction: MatchTransaction,
  invoice: MatchInvoice,
  config: MatchConfig,
  linked: boolean
): ScoredCandidate | null => {
  if (linked) return null
  if (transaction.creditDebit !== 'CRDT') return null
  if (transaction.status !== 'BOOK') return null
  if (invoice.status !== InvoiceStatus.OPEN) return null
  if (invoice.amountDueCents <= 0) return null

  const reference = [
    transaction.description,
    transaction.remittanceInformation,
    transaction.referenceNumber
  ]
    .filter((part): part is string => !!part)
    .join(' ')
  const referenceHits =
    !!invoice.number &&
    containsInvoiceNumber(normalizeReference(reference), invoice.number)
  const amountMatches = transaction.amountCents === invoice.amountDueCents
  const withinWindow = inDateWindow(
    transaction.bookingDate,
    invoice.dueDate,
    config.referenceWindowDays
  )
  const currencyMatches = transaction.currency === invoice.currency

  if (amountMatches && referenceHits && withinWindow) {
    if (currencyMatches) {
      return {
        invoice,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        confidence: 'strict',
        reasons: ['amount', 'reference', 'date']
      }
    }
    return {
      invoice,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      confidence: 'medium',
      reasons: ['currency']
    }
  }
  if (referenceHits && !amountMatches) {
    return {
      invoice,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      confidence: 'medium',
      reasons: ['reference']
    }
  }
  if (amountMatches && withinWindow && !referenceHits) {
    return {
      invoice,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      confidence: 'medium',
      reasons: ['amount']
    }
  }
  if (amountMatches && !withinWindow) {
    return {
      invoice,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      confidence: 'low',
      reasons: ['amount', 'date']
    }
  }
  const direction =
    transaction.amountCents > invoice.amountDueCents ? 'overpay' : 'partial'
  return {
    invoice,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    confidence: 'low',
    reasons: [direction, 'amount']
  }
}

export const matchCreditToInvoices = ({
  transaction,
  invoices,
  config = DEFAULT_MATCH_CONFIG,
  linked = false
}: {
  transaction: MatchTransaction
  invoices: MatchInvoice[]
  config?: MatchConfig
  linked?: boolean
}): MatchResult => {
  const scored = invoices
    .map((invoice) => scoreCandidate(transaction, invoice, config, linked))
    .filter((candidate): candidate is ScoredCandidate => candidate !== null)
  const strictCandidates = scored.filter(
    (candidate) => candidate.confidence === 'strict'
  )
  if (strictCandidates.length === 1) {
    const { invoiceId, reasons } = strictCandidates[0]
    return { level: 'strict', invoiceId, reasons }
  }
  if (strictCandidates.length > 1) {
    return { level: 'none', reasons: ['ambiguous'] }
  }
  const bestSuggestion = scored
    .filter((candidate) => candidate.confidence !== 'strict')
    .sort(
      (a, b) => confidenceRank(a.confidence) - confidenceRank(b.confidence)
    )[0]
  if (bestSuggestion) {
    const { invoiceId, reasons } = bestSuggestion
    return { level: 'suggest', invoiceId, reasons }
  }
  return { level: 'none', reasons: [] }
}

/**
 * Ranked suggestions (top `limit`, default 3) for the review queue. Adoption
 * chips rank above regular suggestions.
 */
export const suggestInvoiceCandidates = ({
  transaction,
  invoices,
  config = DEFAULT_MATCH_CONFIG,
  limit = 3,
  payments = []
}: {
  transaction: MatchTransaction
  invoices: MatchInvoice[]
  config?: MatchConfig
  limit?: number
  payments?: BankPaymentCandidate[]
}): Suggestion[] => {
  const adoptionChips = invoices
    .map((invoice): Suggestion | null => {
      if (
        !findAdoptablePayment({
          transaction,
          payments: payments.filter(
            (payment) => payment.invoiceId === invoice.id
          )
        })
      ) {
        return null
      }
      if (invoice.companyId !== transaction.companyId) return null
      if (invoice.currency !== transaction.currency) return null
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        confidence: 'strict',
        reasons: ['amount', 'banktransfer-payment'],
        adopt: true
      }
    })
    .filter((suggestion): suggestion is Suggestion => suggestion !== null)
  const regular = invoices
    .map((invoice) => scoreCandidate(transaction, invoice, config, false))
    .filter((candidate): candidate is ScoredCandidate => candidate !== null)
    .map(({ invoice, invoiceId, confidence, reasons }) => ({
      invoiceId,
      invoiceNumber: invoice.number,
      confidence,
      reasons
    }))
  const seen = new Set<number>()
  const merged: Suggestion[] = []
  for (const suggestion of [...adoptionChips, ...regular]) {
    if (seen.has(suggestion.invoiceId)) continue
    seen.add(suggestion.invoiceId)
    merged.push(suggestion)
  }
  return merged
    .sort((a, b) => confidenceRank(a.confidence) - confidenceRank(b.confidence))
    .slice(0, limit)
}

const PSP_NAME_PATTERN = /mollie|stripe/i

const hasPspHint = (transaction: MatchTransaction): boolean =>
  !!transaction.counterpartyName?.match(PSP_NAME_PATTERN) ||
  !!transaction.counterpartyIban?.toUpperCase().includes('MOLL') ||
  !!transaction.counterpartyIban?.toUpperCase().includes('STRP') ||
  PSP_NAME_PATTERN.test(transaction.description ?? '') ||
  PSP_NAME_PATTERN.test(transaction.remittanceInformation ?? '')

/**
 * Read-time recognition of a bank credit as a PSP settlement payout.
 */
export const matchSettlementForCredit = (
  transaction: MatchTransaction,
  settlements: PspSettlement[],
  config: MatchConfig = DEFAULT_MATCH_CONFIG
): PspSettlement | null => {
  if (transaction.creditDebit !== 'CRDT' || !transaction.bookingDate) {
    return null
  }

  const inWindow = settlements.filter(
    (candidate) =>
      candidate.status !== 'failed' &&
      candidate.currency === transaction.currency &&
      inDateWindow(
        transaction.bookingDate,
        candidate.payoutDate,
        config.referenceWindowDays
      )
  )
  if (inWindow.length === 0) return null

  const daysFromBooking = (payoutDate: string | null): number =>
    payoutDate === null
      ? Number.MAX_SAFE_INTEGER
      : Math.abs(
          differenceInDays(
            new Date(transaction.bookingDate!),
            new Date(payoutDate)
          )
        )

  const exact = inWindow.filter(
    (candidate) => candidate.amountCents === transaction.amountCents
  )
  if (exact.length > 0) {
    return [...exact].sort(
      (a, b) =>
        daysFromBooking(a.payoutDate) - daysFromBooking(b.payoutDate) ||
        a.externalId.localeCompare(b.externalId)
    )[0]!
  }

  if (!hasPspHint(transaction)) return null
  if (inWindow.length !== 1) return null
  return inWindow[0]!
}

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export const extractInvoiceUuid = (description: string | null): string | null =>
  description?.match(UUID_PATTERN)?.[0]?.toLowerCase() ?? null

export const resolvePspPaymentInvoiceId = (
  payment: { externalId: string; description: string | null },
  paymentByExternalId: ReadonlyMap<string, { invoiceId: number | null }>,
  invoiceIdByUuid: ReadonlyMap<string, number>
): number | null => {
  const linkedPayment = paymentByExternalId.get(payment.externalId)
  if (linkedPayment?.invoiceId != null) return linkedPayment.invoiceId
  const uuid = extractInvoiceUuid(payment.description)
  return uuid ? (invoiceIdByUuid.get(uuid) ?? null) : null
}

/** Minimal PSP payment shape for resolvePspPaymentIds. */
interface PspPaymentMinimal {
  externalId: string
  settlementId: string | null
}

export const resolvePspPaymentIds = (
  settlement: PspSettlement,
  pspPayments: PspPaymentMinimal[],
  payments: BankPaymentCandidate[]
): number[] => {
  const matchedPayments =
    settlement.psp === 'mollie'
      ? payments.filter(
          (payment) => payment.settlementId === settlement.externalId
        )
      : (() => {
          const intentIds = new Set(
            pspPayments
              .filter(
                (payment) => payment.settlementId === settlement.externalId
              )
              .map((payment) => payment.externalId)
          )
          return payments.filter(
            (payment) =>
              payment.settlementId != null &&
              intentIds.has(payment.settlementId)
          )
        })()
  return matchedPayments.map((payment) => payment.id)
}

const MAX_SUBSET_SIZE = 4

const invoiceMatchScore = (
  transaction: MatchTransaction,
  invoice: MatchInvoice
): number => {
  const reference = [
    transaction.description,
    transaction.remittanceInformation,
    transaction.referenceNumber
  ]
    .filter((part): part is string => !!part)
    .join(' ')
  const referenceHit =
    !!invoice.number &&
    containsInvoiceNumber(normalizeReference(reference), invoice.number)
  const dateHit = inDateWindow(
    transaction.bookingDate,
    invoice.dueDate,
    DEFAULT_MATCH_CONFIG.referenceWindowDays
  )
  return (referenceHit ? 1 : 0) + (dateHit ? 1 : 0)
}

const findExactSubsetSum = (
  transaction: MatchTransaction,
  invoices: MatchInvoice[]
): MatchInvoice[] | null => {
  const candidates = invoices
    .filter(
      (invoice) =>
        invoice.status === InvoiceStatus.OPEN &&
        invoice.amountDueCents > 0 &&
        invoice.amountDueCents <= transaction.amountCents
    )
    .sort(
      (a, b) =>
        invoiceMatchScore(transaction, b) - invoiceMatchScore(transaction, a) ||
        (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
    )
  const subsets: MatchInvoice[][] = []
  const search = (
    start: number,
    remaining: number,
    acc: MatchInvoice[]
  ): void => {
    if (acc.length > MAX_SUBSET_SIZE) return
    if (remaining === 0) {
      subsets.push(acc)
      return
    }
    if (remaining < 0) return
    for (let index = start; index < candidates.length; index++) {
      const candidate = candidates[index]!
      if (candidate.amountDueCents > remaining) continue
      search(index + 1, remaining - candidate.amountDueCents, [
        ...acc,
        candidate
      ])
    }
  }
  search(0, transaction.amountCents, [])

  if (subsets.length === 0) return null
  if (subsets.length === 1) return subsets[0]!
  let best: MatchInvoice[] | null = null
  let bestScore = -1
  for (const subset of subsets) {
    const score = subset.reduce(
      (total, invoice) => total + invoiceMatchScore(transaction, invoice),
      0
    )
    if (score > bestScore) {
      bestScore = score
      best = subset
    } else if (score === bestScore) {
      return null
    }
  }
  return best
}

/**
 * Builds the link proposal for one bank credit: a strict single, then a
 * subset-sum multi, then a partial split.
 */
export const buildLinkProposal = ({
  transaction,
  invoices,
  payments,
  config = DEFAULT_MATCH_CONFIG
}: {
  transaction: MatchTransaction
  invoices: MatchInvoice[]
  payments: BankPaymentCandidate[]
  config?: MatchConfig
}): import('./types.js').LinkProposal | null => {
  const scored = invoices
    .map((invoice) => scoreCandidate(transaction, invoice, config, false))
    .filter((candidate): candidate is ScoredCandidate => candidate !== null)
  const strictCandidates = scored.filter(
    (candidate) => candidate.confidence === 'strict'
  )
  if (strictCandidates.length === 1) {
    return {
      type: 'single',
      invoice: strictCandidates[0]!.invoice,
      amountCents: transaction.amountCents
    }
  }

  if (transaction.creditDebit === 'CRDT' && transaction.status === 'BOOK') {
    const reference = [
      transaction.description,
      transaction.remittanceInformation,
      transaction.referenceNumber
    ]
      .filter((part): part is string => !!part)
      .join(' ')
    const referencedOpenInvoices = invoices.filter(
      (invoice) =>
        invoice.status === InvoiceStatus.OPEN &&
        invoice.amountDueCents > 0 &&
        !!invoice.number &&
        containsInvoiceNumber(normalizeReference(reference), invoice.number)
    )
    if (referencedOpenInvoices.length === 1) {
      const invoice = referencedOpenInvoices[0]!
      const appliedAmount = Math.min(
        transaction.amountCents,
        invoice.amountDueCents
      )
      return {
        type: 'split',
        invoice,
        partialAmountCents: appliedAmount,
        invoiceAmountDueCents: invoice.amountDueCents,
        otherCoverageCents: invoice.amountDueCents - appliedAmount
      }
    }
  }

  const subset = findExactSubsetSum(transaction, invoices)
  if (subset) {
    return {
      type: 'multi',
      invoices: subset,
      totalCents: transaction.amountCents
    }
  }

  const adoptable = findAdoptablePayment({ transaction, payments })
  if (adoptable?.invoiceId != null) {
    const invoice = invoices.find(
      (candidate) => candidate.id === adoptable.invoiceId
    )
    if (invoice) {
      return {
        type: 'single',
        invoice,
        amountCents: transaction.amountCents
      }
    }
  }

  const bestPartial = scored
    .filter(
      (candidate) =>
        candidate.confidence !== 'strict' &&
        candidate.invoice.amountDueCents > 0
    )
    .sort(
      (a, b) => confidenceRank(a.confidence) - confidenceRank(b.confidence)
    )[0]
  if (bestPartial) {
    const appliedAmount = Math.min(
      transaction.amountCents,
      bestPartial.invoice.amountDueCents
    )
    return {
      type: 'split',
      invoice: bestPartial.invoice,
      partialAmountCents: appliedAmount,
      invoiceAmountDueCents: bestPartial.invoice.amountDueCents,
      otherCoverageCents: bestPartial.invoice.amountDueCents - appliedAmount
    }
  }

  return null
}

/**
 * Manual-Apply guard: revalidated on every apply so a stale suggestion can
 * never hit a paid/cancelled invoice or a duplicate link.
 */
export const canApply = ({
  transaction,
  invoice,
  alreadyLinked = false
}: {
  transaction: MatchTransaction
  invoice: MatchInvoice
  alreadyLinked?: boolean
}): { ok: boolean; reason?: string } => {
  if (alreadyLinked) {
    return { ok: false, reason: 'transaction is already linked' }
  }
  if (invoice.status !== InvoiceStatus.OPEN) {
    return { ok: false, reason: 'invoice is not open' }
  }
  if (transaction.companyId !== invoice.companyId) {
    return { ok: false, reason: 'transaction company does not match invoice' }
  }
  if (transaction.amountCents > invoice.amountDueCents) {
    return { ok: false, reason: 'payment exceeds the amount due (overpay)' }
  }
  if (invoice.amountDueCents <= 0) {
    return { ok: false, reason: 'invoice has no amount due' }
  }
  return { ok: true }
}
