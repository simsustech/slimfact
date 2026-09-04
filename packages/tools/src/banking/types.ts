/**
 * Wire-level types for the open-banking feature, shared between the api
 * (which produces these payloads over tRPC) and the app (which consumes
 * them). JSON-serialization shapes only: dates are strings on the wire,
 * except `syncedAt` which the tRPC superjson layer may revive into a Date
 * on the client.
 */

/** Direct-credit state is 3-state (unlinked/partial/full); PSP is binary. */
export type Coverage = 'unlinked' | 'partial' | 'full' | 'settled'

/** An invoice as exposed to matching/link proposals. */
export type ProposalInvoice = {
  id: number
  number: string | null
  amountDueCents: number
  dueDate: string | null
  status: string
  companyId: number | null
  currency: string
}

export type PspSettlement = {
  externalId: string
  psp: 'mollie' | 'stripe'
  amountCents: number
  feeCents: number | null
  currency: string
  payoutDate: string | null
  status: string | null
  syncedAt: string | Date | null
  metadata: Record<string, unknown> | null
}

/** A payment inside a PSP settlement (gross amount in cents). */
export type SettlementPayment = {
  paymentExternalId: string
  invoiceNumber: string | null
  /** Invoice uuid so dialogs can link into the invoice page. */
  invoiceUuid: string | null
  amountCents: number
  /** Optional payment status when included by the api. */
  status?: string | null
}

/**
 * A bank-credit → invoice link suggestion, discriminated by shape. `single`
 * is the strict exact match, `multi` a subset-sum of invoices the credit
 * covers, `split` a partial payment toward one invoice (the rest is covered
 * by other transactions).
 */
export type LinkProposal =
  | { type: 'single'; invoice: ProposalInvoice; amountCents: number }
  | { type: 'multi'; invoices: ProposalInvoice[]; totalCents: number }
  | {
      type: 'split'
      invoice: ProposalInvoice
      partialAmountCents: number
      invoiceAmountDueCents: number
      otherCoverageCents: number
    }

export type BankAccount = {
  id: string
  aspspName: string
  aspspCountry: string
  currency: string
  iban: string | null
  needsReconnect: boolean
}

/** What makes up a settled PSP payout: the settlement + its payments. */
export type PspPayoutDetail = {
  settlement: PspSettlement
  payments: SettlementPayment[]
}

/** A row in the bank overview: the transaction + its linking state. */
export type OverviewRow = {
  transaction: {
    externalId: string
    accountExternalId: string
    companyId: number
    amountCents: number
    currency: string
    creditDebit: string
    status: string | null
    bookingDate: string | null
    description: string | null
    remittanceInformation: string | null
    referenceNumber: string | null
    counterpartyName: string | null
    counterpartyIban: string | null
  }
  account: BankAccount
  companyId: number | null
  companyName: string | null
  coverage: Coverage
  linkedInvoices: Array<{ id: number; uuid: string; number: string | null }>
  suggestion: LinkProposal | null
  psp: PspPayoutDetail | null
}

export type ApplyResult = {
  adopted: boolean
  alreadyLinked: boolean
  paymentId: number | null
  invoiceId: number
  /** Set when the link could not be fully applied (e.g. invoice cancelled). */
  error?: string
}

// --- Matching types (used by match.ts, suggest.ts, and api callers) ---

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
  status: string
  companyId: number | null
  currency: string
}

export interface MatchConfig {
  referenceWindowDays: number
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
