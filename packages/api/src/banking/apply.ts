import type { Kysely } from 'kysely'
import {
  InvoiceStatus,
  PaymentMethod,
  type Currencies,
  type FastifyCheckoutInvoiceHandler
} from '@modular-api/fastify-checkout'
import type { DB } from '../kysely/types.js'
import type { MatchInvoice, MatchTransaction } from '@slimfact/tools/banking'
import {
  containsInvoiceNumber,
  findAdoptablePayment,
  normalizeReference,
  sharedSurnameToken
} from '@slimfact/tools/banking'

type AddPayment = FastifyCheckoutInvoiceHandler['addPaymentToInvoice']

/**
 * The narrow checkout seam both the sync worker and the tRPC router cross.
 * The input (including the payment payload) is the upstream contract so it
 * can't drift; the return is narrowed to what the linking logic consumes
 * (the real handler's richer result still satisfies it structurally).
 */
/**
 * True when the credit text names the invoice or the payer's name shares a
 * surname token with the invoice client. Adoption must never happen on the
 * amount alone.
 */
const adoptionTie = (
  transaction: MatchTransaction,
  invoice: MatchInvoice
): boolean => {
  const creditText = normalizeReference(
    [
      transaction.description,
      transaction.remittanceInformation,
      transaction.referenceNumber
    ]
      .filter((part): part is string => !!part)
      .join(' ')
  )
  const numRefHit =
    !!invoice.number && containsInvoiceNumber(creditText, invoice.number)
  const clientTie = sharedSurnameToken(
    transaction.counterpartyName,
    invoice.clientName
  )
  return numRefHit || clientTie
}

export type InvoiceHandler = {
  addPaymentToInvoice: (
    input: Parameters<AddPayment>[0]
  ) => Promise<
    | { success: true; payment: { id: number } }
    | { success: false; errorMessage: string }
  >
}

/** A checkout.payments row reduced to what the linking logic needs. */
export interface BankPaymentRow {
  id: number
  invoiceId: number | null
  transactionReference: string | null
  amount: number
  currency: string
  method: string | null
  status: string | null
  externalId: string | null
  settlementId: string | null
  paymentServiceProvider: string | null
}

/** Bank-linked payments index (one indexed batch query). */
export interface BankPaymentsIndex {
  /** 'bank:<txid>' references already present in checkout.payments. */
  refs: Set<string>
  /** Row lookup by reference — one reference may cover several invoices. */
  byRef: Map<string, BankPaymentRow[]>
}

/**
 * Single indexed batch query for every bank-linked payment
 * (transaction_reference LIKE 'bank:%', backed by the partial unique index).
 * The worker dedupes against this once per sync; the router per request.
 */
export const fetchBankPayments = async (
  db: Kysely<DB>
): Promise<BankPaymentsIndex> => {
  const rows = await db
    .selectFrom('checkout.payments')
    .select([
      'id',
      'invoiceId',
      'transactionReference',
      'amount',
      'currency',
      'method',
      'status',
      'externalId',
      'settlementId',
      'paymentServiceProvider'
    ])
    .where('transactionReference', 'like', 'bank:%')
    .execute()

  const refs = new Set<string>()
  const byRef = new Map<string, BankPaymentRow[]>()
  for (const row of rows) {
    if (!row.transactionReference) continue
    refs.add(row.transactionReference)
    const bucket = byRef.get(row.transactionReference)
    if (bucket) bucket.push(row)
    else byRef.set(row.transactionReference, [row])
  }
  return { refs, byRef }
}

/**
 * Links one bank credit to N invoices in a single pass, sharing one
 * BankPaymentsIndex so the per-invoice (reference, invoice) guard stays
 * consistent across the loop. Returns one LinkResult per invoice.
 */
export const linkBankCreditsToInvoices = async ({
  db,
  invoiceHandler,
  invoices,
  transaction,
  bankRefs
}: {
  db: Kysely<DB>
  invoiceHandler: InvoiceHandler | undefined
  invoices: Array<MatchInvoice & { uuid: string }>
  transaction: MatchTransaction
  bankRefs?: BankPaymentsIndex
}): Promise<LinkResult[]> => {
  const index = bankRefs ?? (await fetchBankPayments(db))
  const reference = `bank:${transaction.externalId}`
  const results: LinkResult[] = []
  for (const invoice of invoices) {
    const result = await linkBankCreditToInvoice({
      db,
      invoiceHandler,
      invoice,
      transaction,
      bankRefs: index
    })
    results.push(result)
    // Keep the shared index current so the next invoice sees this link.
    if (result.paymentId && !result.alreadyLinked && !result.adopted) {
      const existing = index.byRef.get(reference) ?? []
      existing.push({
        id: result.paymentId,
        invoiceId: invoice.id,
        transactionReference: reference,
        amount: transaction.amountCents,
        currency: transaction.currency,
        method: 'banktransfer',
        status: 'paid',
        externalId: null,
        settlementId: null,
        paymentServiceProvider: null
      })
      index.byRef.set(reference, existing)
      index.refs.add(reference)
    }
  }
  return results
}

export type LinkResult =
  | { adopted: true; alreadyLinked: false; paymentId: number }
  | { adopted: false; alreadyLinked: false; paymentId?: number; error?: string }
  | { adopted: false; alreadyLinked: true; paymentId?: number }

const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === '23505'

/**
 * Create-or-adopt: the single seam both the sync worker and the review-queue
 * Apply action cross. Adoption couples an exact-amount paid manual banktransfer
 * payment (ref NULL or the booking date, same company + currency) by setting
 * its transaction_reference; otherwise a new banktransfer payment is created
 * with transaction_reference = 'bank:<txid>'. A concurrent apply that won the
 * race (partial unique index) surfaces as alreadyLinked, never a second payment.
 */
export const linkBankCreditToInvoice = async ({
  db,
  invoiceHandler,
  invoice,
  transaction,
  bankRefs
}: {
  db: Kysely<DB>
  invoiceHandler: InvoiceHandler | undefined
  invoice: MatchInvoice & { uuid: string }
  transaction: MatchTransaction
  /** Optional pre-computed index (the worker fetches it once per sync). */
  bankRefs?: BankPaymentsIndex
}): Promise<LinkResult> => {
  const reference = `bank:${transaction.externalId}`
  const index = bankRefs ?? (await fetchBankPayments(db))

  // Guard: this (reference, invoice) pair must not link twice. The relaxed
  // partial unique index allows ONE reference across several invoices.
  const linkedToThisInvoice = (index.byRef.get(reference) ?? []).some(
    (row) => row.invoiceId === invoice.id
  )
  if (linkedToThisInvoice) {
    return { adopted: false, alreadyLinked: true }
  }

  // Adoption first: couple the exact-amount manual banktransfer payment that
  // was already recorded (ref NULL or the booking date).
  const invoicePayments = await db
    .selectFrom('checkout.payments')
    .select([
      'id',
      'invoiceId',
      'transactionReference',
      'amount',
      'method',
      'status',
      'externalId',
      'settlementId',
      'paymentServiceProvider'
    ])
    .where('invoiceId', '=', invoice.id)
    .where('method', '=', PaymentMethod.banktransfer)
    .execute()
  const adoptable = findAdoptablePayment({
    transaction,
    payments: invoicePayments
  })
  if (adoptable) {
    if (
      invoice.companyId === transaction.companyId &&
      invoice.currency === transaction.currency &&
      // NEVER adopt on amount alone: the bank payer must share a surname
      // token with the invoice client, or the credit text must name the
      // invoice (mirrors the suggestion engine's adoption gate).
      adoptionTie(transaction, invoice)
    ) {
      try {
        await db
          .updateTable('checkout.payments')
          .set({ transactionReference: reference })
          .where('id', '=', adoptable.id)
          .execute()
      } catch (error) {
        if (isUniqueViolation(error)) {
          return { adopted: false, alreadyLinked: true }
        }
        throw error
      }
      return { adopted: true, alreadyLinked: false, paymentId: adoptable.id }
    }
  }

  // Guard: only OPEN/BILL invoices can take a NEW payment — the same gate
  // fastify-checkout applies internally. This seam is shared by the sync worker
  // and the review-queue Apply action, so it enforces the rule itself rather
  // than relying on each caller (the worker's adoption path is not otherwise
  // guarded). A non-OPEN invoice is only reachable here after the adoption path
  // above declined, so the message names the state and the missing precondition
  // instead of surfacing the handler's generic "Could not add payment".
  const invoiceRow = await db
    .selectFrom('checkout.invoices')
    .select('status')
    .where('id', '=', invoice.id)
    .executeTakeFirst()
  if (
    invoiceRow &&
    ![InvoiceStatus.OPEN, InvoiceStatus.BILL].includes(invoiceRow.status)
  ) {
    return {
      adopted: false,
      alreadyLinked: false,
      error:
        invoiceRow.status === InvoiceStatus.CANCELED
          ? 'invoice is cancelled'
          : `invoice is ${invoiceRow.status} — no matching manual bank transfer to adopt`
    }
  }

  if (!invoiceHandler) {
    return {
      adopted: false,
      alreadyLinked: false,
      error: 'checkout invoice handler unavailable'
    }
  }

  try {
    const result = await invoiceHandler.addPaymentToInvoice({
      id: invoice.id,
      payment: {
        amount: transaction.amountCents,
        currency: transaction.currency as Currencies,
        description: transaction.description || invoice.uuid,
        method: PaymentMethod.banktransfer,
        transactionReference: reference,
        // Book the payment on the bank's posting date so paidAt reflects
        // reality instead of sync time.
        date:
          transaction.bookingDate ?? transaction.transactionDate ?? undefined
      }
    })
    if (result.success) {
      // Post-apply re-check: the invoice could have been cancelled between the
      // pre-guard and the payment insert (four-statement seam, no shared tx).
      // The payment row stays (audit trail); surface it so worker/UI can act.
      const statusAfter = await db
        .selectFrom('checkout.invoices')
        .select('status')
        .where('id', '=', invoice.id)
        .executeTakeFirst()
      if (statusAfter?.status === InvoiceStatus.CANCELED) {
        return {
          adopted: false,
          alreadyLinked: false,
          paymentId: result.payment.id,
          error: 'payment recorded but invoice was cancelled concurrently'
        }
      }
      return {
        adopted: false,
        alreadyLinked: false,
        paymentId: result.payment.id
      }
    }
    return { adopted: false, alreadyLinked: false, error: result.errorMessage }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { adopted: false, alreadyLinked: true }
    }
    throw error
  }
}
