/**
 * Shared matching types for bank credit → invoice matching.
 * The full matching logic lives here after step 2; this file is a types-only
 * placeholder for step 1 so suggest.ts and the test can resolve imports.
 */

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

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  referenceWindowDays: 14
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
