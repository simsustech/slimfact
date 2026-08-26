import type { Kysely } from 'kysely'
import type { ExpressionBuilder } from 'kysely'
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus
} from '@modular-api/fastify-checkout'
import { RefundStatus } from '@modular-api/fastify-checkout/types'
import type { DB } from '../kysely/types.js'
import type { Connection, Transaction } from './client.js'
import { parseAmountToCents } from './money.js'
import { buildLinkProposal, findAdoptablePayment } from './match.js'
import type {
  BankPaymentCandidate,
  MatchInvoice,
  MatchTransaction
} from './match.js'
import { fetchAccountCompanyLinks, resolveCompanyIds } from './accountLinks.js'
import { fetchBankPayments, linkBankCreditsToInvoices } from './apply.js'
import type { InvoiceHandler } from './apply.js'
import { startRelay, type RelayFastify } from './events.js'
import { appConfig } from '../config/env.js'

const PAGE_SIZE = 100
const RECENT_WINDOW_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

/** YYYY-MM-DD (the open-banking API's from/to format). */
export const toDateString = (date: Date): string =>
  date.toISOString().slice(0, 10)

export interface SyncResult {
  /** Accounts actually synced (inactive / needs-reconnect / unassigned excluded). */
  accounts: number
  /** New unlinked BOOK credits seen (post-dedupe against bank-linked payments). */
  fetched: number
  /** New checkout.payments rows created via linkBankCreditToInvoice. */
  applied: number
  /** Existing manual banktransfer payments coupled (transaction_reference set). */
  adopted: number
  /** Human-readable labels of connections/accounts skipped for reauth/expiry. */
  skippedRequiresReauth: string[]
}

export type SyncInvoice = MatchInvoice & { uuid: string }

export interface SyncDeps {
  fastify: RelayFastify & {
    checkout?: {
      invoiceHandler?: InvoiceHandler
    }
  }
  db: Kysely<DB>
}

/**
 * Mirrors fastify-checkout's `withAmountDue` subquery so the open-invoice list
 * only includes invoices with a real remaining balance:
 * `totalIncludingTax - paidPayments + queuedRefunds`.
 */
const amountDueExpression = (
  eb: ExpressionBuilder<DB, 'checkout.invoices'>
) => {
  const paidPayments = eb
    .selectFrom('checkout.payments')
    .select((subEb) => subEb.fn.sum<number>('amount').as('total'))
    .whereRef('checkout.payments.invoiceId', '=', 'checkout.invoices.id')
    .where('checkout.payments.status', '=', PaymentStatus.PAID)

  const queuedRefunds = eb
    .selectFrom('checkout.refunds')
    .innerJoin(
      'checkout.payments',
      'checkout.payments.id',
      'checkout.refunds.paymentId'
    )
    .select((subEb) =>
      subEb.fn.sum<number>('checkout.refunds.amount').as('total')
    )
    .whereRef('checkout.payments.invoiceId', '=', 'checkout.invoices.id')
    .where('checkout.refunds.status', 'in', [
      RefundStatus.QUEUED,
      RefundStatus.PENDING,
      RefundStatus.PROCESSING,
      RefundStatus.REFUNDED
    ])

  const afterPayments = eb(
    'checkout.invoices.totalIncludingTax',
    '-',
    eb.fn.coalesce(paidPayments, eb.val(0))
  )
  return eb(afterPayments, '+', eb.fn.coalesce(queuedRefunds, eb.val(0)))
}

const connectionRequiresReauth = (connection: Connection): boolean =>
  connection.status !== 'Active' ||
  (connection.validUntil
    ? new Date(connection.validUntil).getTime() < Date.now()
    : false)

const accountKey = (account: {
  aspspName: string
  aspspCountry: string
}): string => `${account.aspspName}|${account.aspspCountry}`

/**
 * IBANs are compared uppercase without whitespace, so `NL91 ABNA 0417 1643 00`
 * and `NL91ABNA0417164300` match.
 */
export const normalizeIban = (iban: string): string =>
  iban.replace(/\s+/g, '').toUpperCase()

export const toMatchTransaction = (
  transaction: Transaction,
  accountExternalId: string,
  companyId: number
): MatchTransaction => {
  const isCredit = transaction.creditDebitIndicator === 'CRDT'
  return {
    externalId: transaction.id,
    accountExternalId,
    companyId,
    amountCents: parseAmountToCents(transaction.amount),
    currency: transaction.currency,
    creditDebit: transaction.creditDebitIndicator,
    status: transaction.status,
    bookingDate: transaction.bookingDate,
    description: transaction.note ?? null,
    remittanceInformation: transaction.remittanceInformation,
    referenceNumber: transaction.referenceNumber,
    counterpartyName: isCredit
      ? transaction.debtorName
      : transaction.creditorName,
    counterpartyIban: isCredit
      ? transaction.debtorIban
      : transaction.creditorIban
  }
}

const invoiceColumns = (eb: ExpressionBuilder<DB, 'checkout.invoices'>) =>
  [
    'checkout.invoices.id',
    'checkout.invoices.uuid',
    'checkout.invoices.companyId',
    'checkout.invoices.currency',
    'checkout.invoices.dueDate',
    'checkout.invoices.status',
    'checkout.invoices.numberPrefix',
    'checkout.invoices.number',
    amountDueExpression(eb).as('amountDue')
  ] as const

const toSyncInvoice = (row: {
  id: number
  uuid: string | null
  companyId: number | null
  currency: string
  dueDate: string | null
  status: InvoiceStatus
  numberPrefix: string | null
  number: number | null
  amountDue: number | null
}): SyncInvoice => ({
  id: row.id,
  uuid: row.uuid ?? '',
  number: `${row.numberPrefix ?? ''}${row.number ?? ''}`,
  amountDueCents: Number(row.amountDue ?? 0),
  dueDate: row.dueDate,
  status: row.status,
  companyId: row.companyId,
  currency: row.currency
})

/** Open invoices with a real remaining balance (used by the worker + router). */
export const listOpenInvoicesForCompany = async (
  db: Kysely<DB>,
  companyId: number
): Promise<SyncInvoice[]> => {
  const rows = await db
    .selectFrom('checkout.invoices')
    .select((eb) => invoiceColumns(eb))
    .where('checkout.invoices.companyId', '=', companyId)
    .where('checkout.invoices.status', '=', InvoiceStatus.OPEN)
    .orderBy('checkout.invoices.dueDate')
    .execute()

  return rows
    .filter((row) => row.amountDue !== null && row.amountDue > 0)
    .map(toSyncInvoice)
}

/** All of a company's invoices (open + paid) — adoption scoring needs the
 * paid ones too; regular scoring filters OPEN internally. */
export const listCompanyInvoices = async (
  db: Kysely<DB>,
  companyId: number
): Promise<SyncInvoice[]> => {
  const rows = await db
    .selectFrom('checkout.invoices')
    .select((eb) => invoiceColumns(eb))
    .where('checkout.invoices.companyId', '=', companyId)
    .orderBy('checkout.invoices.id', 'desc')
    .execute()
  return rows.map(toSyncInvoice)
}

/** Any invoice by id (adoption can target a fully-paid invoice). */
export const loadInvoiceById = async (
  db: Kysely<DB>,
  invoiceId: number
): Promise<SyncInvoice | null> => {
  const row = await db
    .selectFrom('checkout.invoices')
    .select((eb) => invoiceColumns(eb))
    .where('checkout.invoices.id', '=', invoiceId)
    .executeTakeFirst()
  if (!row) return null
  return toSyncInvoice(row)
}

/**
 * The SlimFact ingest worker: waits for the proxy sync run (when the job
 * carries a runId), then reads granted bank data through the proxy and couples
 * credits to invoices as checkout.payments rows (transaction_reference =
 * 'bank:<txid>'). Idempotent — cron and on-demand runs overlap safely (refs
 * dedupe + partial unique index).
 */
export const processBankSync = async ({
  fastify,
  db,
  runId
}: {
  fastify: SyncDeps['fastify']
  db: Kysely<DB>
  runId?: string
}): Promise<SyncResult> => {
  const result: SyncResult = {
    accounts: 0,
    fetched: 0,
    applied: 0,
    adopted: 0,
    skippedRequiresReauth: []
  }
  if (appConfig.bankingIngestDisabled) {
    fastify.log.warn(
      'banking: ingest disabled (BANKING_INGEST_DISABLED) — skipping auto-apply'
    )
    return result
  }

  if (runId) {
    const relay = await startRelay({ fastify })
    const outcome = await relay.waitForSyncRun(runId)
    if (outcome === 'timeout') {
      fastify.log.warn(
        `banking: sync ${runId} not confirmed via the bus; ingesting anyway`
      )
    }
  }

  const client = fastify.banking.getClient()
  if (!client) {
    fastify.log.warn('banking: not configured, skipping sync')
    return result
  }
  const invoiceHandler = fastify.checkout?.invoiceHandler

  // Surface connections that need re-auth or have expired; skip their accounts.
  const connections = await client.getConnections()
  const inactiveConnections = connections.filter(connectionRequiresReauth)
  const inactiveConnectionKeys = new Set(
    inactiveConnections.map((connection) => accountKey(connection))
  )
  const skippedReauth = new Set<string>()
  for (const connection of inactiveConnections) {
    const label =
      connection.status !== 'Active'
        ? `connection ${connection.sessionId} (${connection.aspspName}) status ${connection.status}`
        : `connection ${connection.sessionId} (${connection.aspspName}) expired ${connection.validUntil}`
    fastify.log.warn(`banking: skipping ${label}`)
    skippedReauth.add(label)
  }

  // Accounts are not stored with a connection id in the DB, so map them to
  // connections by (aspspName, aspspCountry) via the API and skip any that
  // need re-consent.
  const apiAccounts = await client.getAccounts()
  const inactiveAccountApiIds = new Set(
    apiAccounts
      .filter(
        (apiAccount) =>
          apiAccount.needsReconnect ||
          inactiveConnectionKeys.has(accountKey(apiAccount))
      )
      .map((apiAccount) => apiAccount.id)
  )
  for (const apiAccount of apiAccounts) {
    if (!inactiveAccountApiIds.has(apiAccount.id)) continue
    const label = `account ${apiAccount.id} (${apiAccount.aspspName}) ${
      apiAccount.needsReconnect
        ? 'needs reconnect'
        : 'under inactive connection'
    }`
    fastify.log.warn(`banking: skipping ${label}`)
    skippedReauth.add(label)
  }
  result.skippedRequiresReauth = [...skippedReauth]

  // Company per account is derived by IBAN on every sync (no local working set).
  const companies = await db
    .selectFrom('companies')
    .select(['id', 'iban'])
    .execute()
  const companyIdByIban = new Map(
    companies.map((company) => [normalizeIban(company.iban), company.id])
  )

  // One dedupe index for the whole sync: every already-linked transaction
  // reference. The worker only ever creates one payment per bank transaction.
  const bankRefs = await fetchBankPayments(db)
  const refs = bankRefs.refs
  const accountCompanyLinks = await fetchAccountCompanyLinks(db)

  const recentWindowFrom = toDateString(
    new Date(Date.now() - RECENT_WINDOW_DAYS * DAY_MS)
  )

  for (const apiAccount of apiAccounts) {
    if (inactiveAccountApiIds.has(apiAccount.id)) continue
    if (!apiAccount.iban) continue
    const companyIds = resolveCompanyIds(
      accountCompanyLinks,
      companyIdByIban,
      apiAccount
    )
    if (companyIds.length === 0) {
      fastify.log.warn(
        `banking: no company with IBAN ${apiAccount.iban} — account ${apiAccount.id} left unassigned`
      )
      continue
    }
    result.accounts += 1

    // Recent window default (proxy keeps complete history; overview widens via
    // from/to). Paged fetch.
    let offset = 0
    let fetchedTransactions: Transaction[] = []
    while (true) {
      const page = await client.getTransactions(apiAccount.id, {
        from: recentWindowFrom,
        limit: PAGE_SIZE,
        offset
      })
      if (page.items.length === 0) break
      fetchedTransactions = fetchedTransactions.concat(page.items)
      offset += page.items.length
      if (offset >= page.total) break
      if (page.items.length < PAGE_SIZE) break
    }

    // Per-company candidate sets (many-to-many): a shared account matches
    // against each linked company's invoices separately.
    const openInvoicesByCompany = new Map<number, SyncInvoice[]>()
    const adoptablePaymentsByCompany = new Map<number, BankPaymentCandidate[]>()
    for (const companyId of companyIds) {
      openInvoicesByCompany.set(
        companyId,
        await listOpenInvoicesForCompany(db, companyId)
      )
      const companyInvoiceIds = await db
        .selectFrom('checkout.invoices')
        .select('id')
        .where('companyId', '=', companyId)
        .execute()
      adoptablePaymentsByCompany.set(
        companyId,
        companyInvoiceIds.length > 0
          ? await db
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
              .where(
                'invoiceId',
                'in',
                companyInvoiceIds.map((row) => row.id)
              )
              .where('method', '=', PaymentMethod.banktransfer)
              .execute()
          : []
      )
    }

    for (const apiTransaction of fetchedTransactions) {
      if (apiTransaction.creditDebitIndicator !== 'CRDT') continue
      if ((apiTransaction.status ?? 'BOOK') !== 'BOOK') continue
      const reference = `bank:${apiTransaction.id}`
      if (refs.has(reference)) continue // already linked
      result.fetched += 1

      for (const companyId of companyIds) {
        const transaction = toMatchTransaction(
          apiTransaction,
          apiAccount.id,
          companyId
        )

        // Adoption first (company-wide): couple an exact-amount manual
        // banktransfer payment instead of creating a second payment. This
        // also covers invoices that are already fully covered (amountDue 0
        // → never proposed).
        const adoptable = findAdoptablePayment({
          transaction,
          payments: adoptablePaymentsByCompany.get(companyId) ?? []
        })
        if (adoptable?.invoiceId != null) {
          const invoice = await loadInvoiceById(db, adoptable.invoiceId)
          if (invoice) {
            const [link] = await linkBankCreditsToInvoices({
              db,
              invoiceHandler,
              invoices: [invoice],
              transaction,
              bankRefs
            })
            if (link?.adopted) {
              result.adopted += 1
              refs.add(reference)
              break
            }
          }
        }

        // Strict single/multi only — PSP payouts are recognized read-time in
        // listTransactions (never auto-applied), and split suggestions need
        // a human deciding how the rest is covered.
        const proposal = buildLinkProposal({
          transaction,
          invoices: openInvoicesByCompany.get(companyId) ?? [],
          payments: adoptablePaymentsByCompany.get(companyId) ?? []
        })
        if (proposal?.type !== 'single' && proposal?.type !== 'multi') {
          continue
        }

        const proposalInvoices = (
          proposal.type === 'single' ? [proposal.invoice] : proposal.invoices
        )
          .map((invoice) =>
            openInvoicesByCompany
              .get(companyId)
              ?.find((candidate) => candidate.id === invoice.id)
          )
          .filter((invoice): invoice is SyncInvoice => invoice !== undefined)
        const links = await linkBankCreditsToInvoices({
          db,
          invoiceHandler,
          invoices: proposalInvoices,
          transaction,
          bankRefs
        })
        for (const link of links) {
          if (link.adopted) {
            result.adopted += 1
          } else if (link.paymentId && !link.alreadyLinked) {
            result.applied += 1
          } else if ('error' in link && link.error) {
            fastify.log.warn(
              `banking: apply failed for txn ${transaction.externalId}: ${link.error}`
            )
          }
        }
        refs.add(reference)
        break
      }
    }
  }
  return result
}
