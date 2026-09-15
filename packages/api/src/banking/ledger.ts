import type { Kysely } from 'kysely'
import type { DB } from '../kysely/types.js'

/**
 * One row of the unified payments ledger. `kind` discriminates recognized
 * payments (`payment`) and refunds (negative `amountCents`).
 * Bank review rows are gone — they now live in the Suggestions tab.
 */
export interface LedgerRow {
  kind: 'payment' | 'refund'
  id: number | null
  uuid: string | null
  /** ISO-ish display instant: paidAt ?? createdAt. */
  date: string
  dateMs: number
  method: string
  amountCents: number
  currency: string
  status: string
  description: string
  transactionReference: string | null
  externalId: string | null
  psp: string | null
  settlementId: string | null
  invoiceId: number | null
  invoiceUuid: string | null
  invoiceNumber: string | null
  clientName: string | null
}
