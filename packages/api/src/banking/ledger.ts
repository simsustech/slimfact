import type { Kysely } from 'kysely'
import type { DB } from '../kysely/types.js'
import type { BankingApi, Transaction } from './client.js'
import { parseAmountToCents } from './money.js'
import { fetchAccountCompanyLinks, resolveCompanyIds } from './accountLinks.js'
import { matchSettlementForCredit, type MatchTransaction } from './match.js'
import { toMatchTransaction } from './sync.js'

/**
 * One row of the unified payments ledger. `kind` discriminates recognized
 * payments (`payment`), refunds (negative `amountCents`), and unmatched
 * incoming bank credits (`bank`, read-only review rows).
 */
export interface LedgerRow {
  kind: 'payment' | 'refund' | 'bank'
  id: number | null
  uuid: string | null
  /** ISO-ish display instant: paidAt ?? createdAt (bank: bookingDate). */
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
  bankSynced: boolean
  /** Bank-review rows only: proxy account + resolved company attribution. */
  bankAccountExternalId?: string | null
  bankIban?: string | null
  bankCompanyIds?: number[]
  bankCompanyName?: string | null
}

const PAGE_SIZE = 100
const MAX_FETCH = 500

/** Parses the text-format timestamps stored by checkout (e.g. "2026-03-01 09:00:00+00"). */
export const parseCheckoutTimestamp = (value: Date | string): number => {
  if (value instanceof Date) return value.getTime()
  const normalized = value.includes('T')
    ? value
    : value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const parsed = new Date(normalized).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Credits (CRDT, BOOK) from every account whose ids did NOT mint a payment
 * row (checkout.payments.transaction_reference = 'bank:<txid>'). These are
 * the read-only "needs review" rows; linked credits are represented by their
 * payment rows alone.
 */
export const fetchUnmatchedCredits = async ({
  db,
  client,
  from,
  to
}: {
  db: Kysely<DB>
  client: BankingApi
  from?: string
  to?: string
}): Promise<LedgerRow[]> => {
  const accounts = await client.getAccounts()
  const links = await fetchAccountCompanyLinks(db)
  const companies = await db
    .selectFrom('companies')
    .select(['id', 'name'])
    .execute()
  const companiesById = new Map(
    companies.map((company) => [company.id, company])
  )

  // Collect credits per account so each unmatched row keeps its account.
  const creditsByAccountExternalId: Array<{
    account: (typeof accounts)[number]
    items: Transaction[]
  }> = []
  for (const account of accounts) {
    let offset = 0
    while (offset < MAX_FETCH) {
      const page = await client.getTransactions(account.id, {
        from,
        to,
        limit: PAGE_SIZE,
        offset
      })
      if (page.items.length === 0) break
      const credits = page.items.filter(
        (item) =>
          item.creditDebitIndicator === 'CRDT' &&
          (item.status ?? 'BOOK') === 'BOOK'
      )
      if (credits.length > 0) {
        let bucket = creditsByAccountExternalId.find(
          (entry) => entry.account.id === account.id
        )
        if (!bucket) {
          bucket = { account, items: [] }
          creditsByAccountExternalId.push(bucket)
        }
        bucket.items.push(...credits)
      }
      offset += page.items.length
      if (offset >= page.total) break
    }
  }

  const allCredits = creditsByAccountExternalId.flatMap((entry) => entry.items)
  if (allCredits.length === 0) return []

  // Read-time PSP recognition mirrors the bank overview: an UNRECONCILED
  // credit that IS a payout (psp_settlements) is settled by data we already
  // have — it never becomes a "needs review" row.
  const pspSettlements = await client.getPspSettlements()
  const availableSettlements = [...pspSettlements]
  const isRecognizedPayout = (
    item: Transaction,
    accountExternalId: string
  ): boolean => {
    const match: MatchTransaction = toMatchTransaction(
      item,
      accountExternalId,
      0
    )
    const matched = matchSettlementForCredit(match, availableSettlements)
    if (matched) {
      availableSettlements.splice(
        availableSettlements.findIndex(
          (candidate) => candidate.externalId === matched.externalId
        ),
        1
      )
      return true
    }
    return false
  }

  const references = allCredits.map((item) => `bank:${item.id}`)
  const linkedRows = await db
    .selectFrom('checkout.payments')
    .select('transactionReference')
    .where('transactionReference', 'in', references)
    .execute()
  const linkedRefs = new Set(linkedRows.map((row) => row.transactionReference))

  const rows: LedgerRow[] = []
  for (const { account, items } of creditsByAccountExternalId) {
    const companyIds = account.iban
      ? resolveCompanyIds(links, new Map(), account)
      : []
    const companyName =
      companyIds
        .map((id) => companiesById.get(id)?.name)
        .filter((name): name is string => !!name)
        .join(', ') || null

    for (const item of items) {
      if (linkedRefs.has(`bank:${item.id}`)) continue
      if (isRecognizedPayout(item, account.id)) continue
      const date = item.bookingDate ?? item.valueDate ?? item.transactionDate
      rows.push({
        kind: 'bank',
        id: null,
        uuid: null,
        date: date ?? '',
        dateMs: date ? new Date(`${date}T12:00:00Z`).getTime() : 0,
        method: 'bank',
        amountCents: parseAmountToCents(item.amount),
        currency: item.currency,
        status: 'needsReview',
        description:
          item.creditorName ??
          item.remittanceInformation ??
          item.note ??
          'Incoming bank credit',
        transactionReference: `bank:${item.id}`,
        externalId: null,
        psp: null,
        settlementId: null,
        invoiceId: null,
        invoiceUuid: null,
        invoiceNumber: null,
        clientName: null,
        bankSynced: false,
        bankAccountExternalId: account.id,
        bankIban: account.iban ?? null,
        bankCompanyIds: companyIds,
        bankCompanyName: companyName
      })
    }
  }
  return rows
}
