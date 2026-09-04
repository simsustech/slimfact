import { differenceInCalendarDays } from 'date-fns'
import { InvoiceStatus } from '@modular-api/fastify-checkout'
import { containsInvoiceNumber, normalizeReference } from './normalize.js'
import type { PspPayment, PspSettlement } from './client.js'
import type { LinkProposal as SharedLinkProposal } from '@slimfact/tools/banking'

export interface MatchTransaction {
  externalId: string
  accountExternalId: string
  companyId: number
  amountCents: number
  currency: string
  creditDebit: string
  status: string | null
  bookingDate: string | null
  transactionDate: string | null
  description: string | null
  remittanceInformation: string | null
  referenceNumber: string | null
  counterpartyName: string | null
  counterpartyIban: string | null
}

export interface MatchInvoice {
  id: number
  number: string | null
  amountDueCents: number
  dueDate: string | null
  status: InvoiceStatus
  companyId: number | null
  currency: string
}

export interface MatchConfig {
  referenceWindowDays: number
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  referenceWindowDays: 14
}

export type MatchLevel = 'strict' | 'suggest' | 'none'

export interface MatchResult {
  level: MatchLevel
  invoiceId?: number
  reasons: string[]
}

type Confidence = 'strict' | 'medium' | 'low'

export interface Suggestion {
  invoiceId: number
  /** Invoice number — lets the review queue render a precise chip even when
   * the invoice is already paid and therefore absent from `openInvoices`. */
  invoiceNumber: string | null
  confidence: Confidence
  reasons: string[]
  /** True when the suggestion is a proactive adoption chip: the invoice already
   * has an exact-amount paid manual banktransfer payment to couple instead of
   * creating a second payment. */
  adopt?: boolean
}

interface ScoredCandidate extends Suggestion {
  invoice: MatchInvoice
}

/** A checkout.payments row reduced to the fields the matching logic needs. */
export interface BankPaymentCandidate {
  id: number
  invoiceId: number | null
  amount: number
  method: string | null
  status: string | null
  transactionReference: string | null
  /** PSP payment id (Mollie tr_ / Stripe payment_intent) when paid via a PSP. */
  externalId: string | null
  /** Mollie settlement id / Stripe payment_intent id (checkout plugin's
   * settlement_id column). */
  settlementId: string | null
  paymentServiceProvider: string | null
}

const confidenceRank = (confidence: Confidence): number =>
  confidence === 'strict' ? 0 : confidence === 'medium' ? 1 : 2

const inDateWindow = (
  bookingDate: string | null,
  dueDate: string | null,
  windowDays: number
): boolean => {
  if (!bookingDate || !dueDate) return false
  return (
    Math.abs(
      differenceInCalendarDays(new Date(bookingDate), new Date(dueDate))
    ) <= windowDays
  )
}

/**
 * Adoption predicate: a paid manual banktransfer payment (same exact amount,
 * no other reference, or the booking date itself) can be coupled to the bank
 * credit instead of creating a second payment. The caller additionally checks
 * company (via the payment's invoice) and currency.
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
        // No reference yet: NULL or '' (the POS flow stores an empty string)
        // or the booking date itself.
        (payment.transactionReference === null ||
          payment.transactionReference === '' ||
          payment.transactionReference === transaction.bookingDate)
    ) ?? null
  )
}

const scoreCandidate = (
  transaction: MatchTransaction,
  invoice: MatchInvoice,
  config: MatchConfig,
  linked: boolean
): ScoredCandidate | null => {
  // A credit that is already coupled to a checkout.payments row (via
  // transaction_reference = 'bank:<txid>') is never matched again.
  if (linked) return null
  // Booked, incoming credits are the only participants.
  if (transaction.creditDebit !== 'CRDT') return null
  if (transaction.status !== 'BOOK') return null
  // Open invoices with an amount still due are the only candidates.
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

  // Strict (auto-apply): exact amount + reference + in-window + same currency.
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
    // Currency mismatch: strong candidate but never auto-applied.
    return {
      invoice,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      confidence: 'medium',
      reasons: ['currency']
    }
  }
  // Reference hit but amount off -> medium.
  if (referenceHits && !amountMatches) {
    return {
      invoice,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      confidence: 'medium',
      reasons: ['reference']
    }
  }
  // Amount + date match without a reference -> medium (e.g. PSP settlements
  // still land in the review queue, never auto-applied).
  if (amountMatches && withinWindow && !referenceHits) {
    return {
      invoice,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      confidence: 'medium',
      reasons: ['amount']
    }
  }
  // Amount matches but outside the date window -> low.
  if (amountMatches && !withinWindow) {
    return {
      invoice,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      confidence: 'low',
      reasons: ['amount', 'date']
    }
  }
  // Partial / overpay without a reference -> low.
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
 * chips (invoices with an exact-amount paid manual banktransfer payment) rank
 * above regular suggestions. Callers only feed unlinked credits here.
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

/**
 * A bank-credit → invoice link suggestion, discriminated by shape. `single`
 * is the strict exact match, `multi` a subset-sum of invoices the credit
 * covers, `split` a partial payment toward one invoice (the rest is covered
 * by other transactions). PSP payouts are not link proposals — they are
 * recognized read-time (see matchSettlementForCredit).
 */
export type LinkProposal =
  | { type: 'single'; invoice: MatchInvoice; amountCents: number }
  | { type: 'multi'; invoices: MatchInvoice[]; totalCents: number }
  | {
      type: 'split'
      invoice: MatchInvoice
      partialAmountCents: number
      invoiceAmountDueCents: number
      otherCoverageCents: number
    }
// Compile-time guarantee: api proposals satisfy the shared wire contract in
// @slimfact/tools/banking consumed by the app.
/** Compile-time assertion: api proposals satisfy the shared wire contract. */
export type LinkProposalSharedContractCheck =
  LinkProposal extends SharedLinkProposal ? true : never

const PSP_NAME_PATTERN = /mollie|stripe/i

/**
 * PSP payout heuristics: counterparty name/IBAN or a PSP name in the
 * booking description/remittance (e.g. "MOLLIE SETTLEMENT 202").
 */
const hasPspHint = (transaction: MatchTransaction): boolean =>
  !!transaction.counterpartyName?.match(PSP_NAME_PATTERN) ||
  !!transaction.counterpartyIban?.toUpperCase().includes('MOLL') ||
  !!transaction.counterpartyIban?.toUpperCase().includes('STRP') ||
  PSP_NAME_PATTERN.test(transaction.description ?? '') ||
  PSP_NAME_PATTERN.test(transaction.remittanceInformation ?? '')

/**
 * Read-time recognition of a bank credit as a PSP settlement payout. Two
 * tiers: exact (amount + currency + date window) and hint-based (PSP
 * counterparty/description with a unique currency-matching candidate —
 * covers fee-net payouts where the credit ≠ settlement gross). Ambiguous
 * exact matches resolve deterministically to the closest payout date
 * (tie-break: lowest externalId); ambiguous hint matches never guess.
 * The caller owns consumption: it removes the returned settlement from the
 * candidate list before the next transaction.
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
      // Only recognizable while the money relationship is live — an
      // explicitly failed settlement never hit the bank and is a decoy
      // for lookalike credits. Other statuses (paidout/paid_out/open/…)
      // are accepted: providers spell them inconsistently.
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
          differenceInCalendarDays(
            new Date(transaction.bookingDate!),
            new Date(payoutDate)
          )
        )

  // Exact tier: the settlement's net equals the credit amount.
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

  // Hint tier: PSP counterparty/description and exactly one candidate.
  if (!hasPspHint(transaction)) return null
  if (inWindow.length !== 1) return null
  return inWindow[0]!
}

/**
 * The checkout.payments ids inside one settlement. Mollie stores the
 * settlement id on each payment; Stripe stores the payment_intent id, which
 * equals psp_payments.externalId for the settlement. Unresolvable rows are
 * skipped — the settlement can still reconcile.
 */
/** Invoice uuids as stored in the PSP payment description by the checkout
 * plugin (plain `invoice.uuid` or a localized label containing it). */
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export const extractInvoiceUuid = (description: string | null): string | null =>
  description?.match(UUID_PATTERN)?.[0]?.toLowerCase() ?? null

/**
 * Resolves the invoice behind a PSP payment inside a settlement. Primary seam:
 * the matching checkout.payments row (same external id). Fallback: the invoice
 * uuid that the checkout plugin stores in the payment description.
 */
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

export const resolvePspPaymentIds = (
  settlement: PspSettlement,
  pspPayments: PspPayment[],
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

/** 0..2 — reference hit counts 1, in-window due date counts 1. */
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

/**
 * Bounded backtracking over open invoices whose amountDue <= the credit:
 * finds subsets summing EXACTLY to the credit. Max subset size 4, pruned when
 * the running sum exceeds the target. Multiple subsets: prefer the one with
 * the most reference/date hits; a tie returns null (never guess).
 */
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
 * subset-sum multi, then a partial split. Returns null when nothing is
 * linkable. Callers validate company/currency/amount before applying.
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
}): LinkProposal | null => {
  // (ii) Single: exactly one strict candidate (reuse scoreCandidate).
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

  // (ii-bis) Reference-priority: a booked credit whose note/remittance/reference
  // names exactly one open invoice is split toward it — even when a subset-sum
  // would cover other invoices. Mirrors scoreCandidate's entry guards so
  // debits / non-booked transactions never get a spurious split; 0 or ≥2
  // referenced invoices fall through to the subset-sum below.
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

  // (iii) Multi: exact subset-sum over open invoices.
  const subset = findExactSubsetSum(transaction, invoices)
  if (subset) {
    return {
      type: 'multi',
      invoices: subset,
      totalCents: transaction.amountCents
    }
  }

  // (iv) Adoption: a paid invoice with an exact-amount manual banktransfer
  // payment (no reference yet) can be coupled instead of creating a payment.
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

  // (v) Split: best partial candidate. Overpay may still be PROPOSED (the
  // dialog explains the credit exceeds the invoice) — canApply guards the
  // write path and rejects an overpay for a lone invoice.
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
 * Manual-Apply guard: revalidated on every apply (auto or manual) so a stale
 * suggestion can never hit a paid/cancelled invoice or a duplicate link.
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
