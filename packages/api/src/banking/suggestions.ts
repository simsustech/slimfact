/**
 * Data assembly for the Suggestions tab — actionable unlinked bank credits.
 * Pure logic over kysely + the tools matching engine.
 */

import type { Kysely } from 'kysely'
import type { DB } from '../kysely/types.js'
import type { Transaction } from './client.js'
import type { MatchTransaction } from '@slimfact/tools/banking'
import { suggestForCredit } from '@slimfact/tools/banking/suggest'
import { toMatchTransaction, listCompanyInvoices } from './sync.js'

export interface SuggestionRow {
  transaction: MatchTransaction
  companyId: number | null
  topSuggestion: {
    invoiceId: number
    invoiceNumber: string | null
    score: number
    evidence: {
      numRefHit: boolean
      clientScore: number
      adoptablePaymentId: number | null
    }
  } | null
  candidateInvoiceUuids: string[]
  adoptableInvoiceIds: number[]
}

/**
 * Lists actionable unlinked bank credits with matching suggestions.
 * One suggestion per credit; credits with no actionable match are omitted.
 */
export const listActionableSuggestions = async ({
  db,
  transactions,
  account,
  companyIds,
  limit = 50,
  offset = 0
}: {
  db: Kysely<DB>
  transactions: Transaction[]
  account: { id: string; iban: string | null }
  companyIds: number[]
  limit?: number
  offset?: number
}): Promise<SuggestionRow[]> => {
  const results: SuggestionRow[] = []

  for (const apiTx of transactions) {
    if (apiTx.creditDebitIndicator !== 'CRDT') continue
    if ((apiTx.status ?? 'BOOK') !== 'BOOK') continue

    for (const companyId of companyIds) {
      const matchTx = toMatchTransaction(apiTx, account.id, companyId)
      const invoices = await listCompanyInvoices(db, companyId)
      const payments = await allPaymentsForCompany(db, companyId)

      const result = suggestForCredit({
        transaction: matchTx,
        invoices: invoices.map((inv) => ({
          id: inv.id,
          number: inv.number,
          amountDueCents: inv.amountDueCents,
          dueDate: inv.dueDate,
          status: inv.status,
          companyId: inv.companyId,
          currency: inv.currency
        })),
        payments: payments.map((p) => ({
          id: p.id,
          invoiceId: p.invoiceId,
          amount: p.amount,
          method: p.method,
          status: p.status,
          transactionReference: p.transactionReference,
          externalId: p.externalId,
          settlementId: p.settlementId,
          paymentServiceProvider: p.paymentServiceProvider
        })),
        config: { referenceWindowDays: 14 }
      })

      if (result) {
        const candidateUuids = invoices
          .filter((inv) => inv.companyId === companyId)
          .filter((inv) => inv.status === 'open' || inv.status === 'concept')
          .map((inv) => inv.uuid)

        const adoptableIds = payments
          .filter(
            (p) =>
              p.method === 'banktransfer' &&
              p.status === 'paid' &&
              p.invoiceId != null &&
              (p.transactionReference === null || p.transactionReference === '')
          )
          .map((p) => p.invoiceId!)

        results.push({
          transaction: matchTx,
          companyId,
          topSuggestion: {
            invoiceId: result.invoiceId,
            invoiceNumber:
              invoices.find((inv) => inv.id === result.invoiceId)?.number ??
              null,
            score: result.score,
            evidence: result.evidence
          },
          candidateInvoiceUuids: candidateUuids,
          adoptableInvoiceIds: adoptableIds
        })

        break // One suggestion per credit
      }
    }
  }

  return results.slice(offset, offset + limit)
}

/**
 * Fetches all payments for a company.
 */
const allPaymentsForCompany = async (
  db: Kysely<DB>,
  companyId: number
): Promise<
  Array<{
    id: number
    invoiceId: number | null
    amount: number
    method: string | null
    status: string | null
    transactionReference: string | null
    externalId: string | null
    settlementId: string | null
    paymentServiceProvider: string | null
  }>
> => {
  return db
    .selectFrom('checkout.payments')
    .select([
      'id',
      'invoiceId',
      'amount',
      'method',
      'status',
      'transactionReference',
      'externalId',
      'settlementId',
      'paymentServiceProvider'
    ])
    .where('invoiceId', 'in', (eb) =>
      eb
        .selectFrom('checkout.invoices')
        .select('id')
        .where('companyId', '=', companyId)
    )
    .execute()
}
