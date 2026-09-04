import { TRPCError } from '@trpc/server'
import { t } from '../index.js'
import * as z from 'zod'
import type { FastifyInstance } from 'fastify'
import { db } from '../../kysely/index.js'
import { bankingEnabled } from '../../config/env.js'
import { InvoiceStatus, type Currencies } from '@modular-api/fastify-checkout'
import {
  buildLinkProposal,
  canApply,
  findAdoptablePayment,
  matchSettlementForCredit,
  extractInvoiceUuid,
  resolvePspPaymentInvoiceId,
  type BankPaymentCandidate,
  type LinkProposal,
  type MatchTransaction
} from '@slimfact/tools/banking'
import { suggestForCredit } from '@slimfact/tools/banking/suggest'
import {
  fetchAccountCompanyLinks,
  resolveCompanyIds,
  setAccountCompanies
} from '../../banking/accountLinks.js'
import {
  listCompanyInvoices,
  loadInvoiceById,
  normalizeIban,
  toMatchTransaction
} from '../../banking/sync.js'
import {
  fetchBankPayments,
  linkBankCreditsToInvoices,
  type BankPaymentRow
} from '../../banking/apply.js'
import { getBossOrThrow } from '../../pgboss.js'
import type {
  Account,
  BankingApi,
  PspPayment,
  PspSettlement,
  Transaction
} from '../../banking/client.js'
import { parseAmountToCents } from '../../banking/money.js'

const PAGE_SIZE = 100
const MAX_FETCH = 500

/** What makes up a settled PSP payout: the settlement + its payments. */
export interface PspPayoutDetail {
  settlement: PspSettlement
  payments: Array<{
    paymentExternalId: string
    invoiceNumber: string | null
    /** Invoice uuid so the settlement dialog can link into the invoice page. */
    invoiceUuid: string | null
    amountCents: number
    status: string | null
  }>
}
const isCurrency = (value: string): value is Currencies =>
  value === 'EUR' || value === 'USD'

type RouterProcedure = typeof t.procedure

const fetchAccountTransactions = async (
  client: BankingApi,
  accountId: string,
  from?: string,
  to?: string
): Promise<Transaction[]> => {
  const transactions: Transaction[] = []
  let offset = 0
  while (transactions.length < MAX_FETCH) {
    const page = await client.getTransactions(accountId, {
      from,
      to,
      limit: PAGE_SIZE,
      offset
    })
    if (page.items.length === 0) break
    transactions.push(...page.items)
    offset += page.items.length
    if (offset >= page.total) break
  }
  return transactions
}

const loadCompaniesByIban = async (): Promise<Map<string, number>> => {
  const companies = await db
    .selectFrom('companies')
    .select(['id', 'iban'])
    .execute()
  return new Map(
    companies.map((company) => [normalizeIban(company.iban), company.id])
  )
}

const loadCompaniesById = async (): Promise<
  Map<number, { id: number; name: string }>
> => {
  const companies = await db
    .selectFrom('companies')
    .select(['id', 'name'])
    .execute()
  return new Map(companies.map((company) => [company.id, company]))
}

const loadInvoicesByIds = async (
  invoiceIds: number[]
): Promise<
  Map<number, { id: number; uuid: string; number: string | null }>
> => {
  if (invoiceIds.length === 0) return new Map()
  const rows = await db
    .selectFrom('checkout.invoices')
    .select(['id', 'uuid', 'numberPrefix', 'number'])
    .where('id', 'in', invoiceIds)
    .execute()
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        uuid: row.uuid ?? '',
        number: `${row.numberPrefix ?? ''}${row.number ?? ''}`
      }
    ])
  )
}
type InvoiceLookup = Map<
  number,
  { id: number; uuid: string; number: string | null }
>

/**
 * Resolves invoice ids for PSP payment description UUIDs so drill-downs can
 * name the invoice even when the external id differs.
 */
const loadInvoiceIdByUuid = async (
  pspPayments: PspPayment[]
): Promise<Map<string, number>> => {
  const descriptionUuids = new Set<string>()
  for (const payment of pspPayments) {
    const uuid = extractInvoiceUuid(payment.description)
    if (uuid) descriptionUuids.add(uuid)
  }
  if (descriptionUuids.size === 0) return new Map()
  const uuidRows = await db
    .selectFrom('checkout.invoices')
    .select(['id', 'uuid'])
    .where('uuid', 'in', [...descriptionUuids])
    .execute()
  return new Map(uuidRows.map((row) => [row.uuid.toLowerCase(), row.id]))
}

/** Maps one settlement's proxy payments to display rows with invoice links. */
const mapSettlementPayments = (
  pspPayments: PspPayment[],
  settlementId: string,
  paymentByExternalId: Map<string, BankPaymentRow>,
  invoiceIdByUuid: Map<string, number>,
  invoiceById: InvoiceLookup
) =>
  pspPayments
    .filter((payment) => payment.settlementId === settlementId)
    .map((payment) => {
      const invoiceId = resolvePspPaymentInvoiceId(
        payment,
        paymentByExternalId,
        invoiceIdByUuid
      )
      const invoice = invoiceId != null ? invoiceById.get(invoiceId) : undefined
      return {
        paymentExternalId: payment.externalId,
        invoiceNumber: invoice?.number ?? null,
        invoiceUuid: invoice?.uuid ?? null,
        amountCents: payment.amountCents,
        status: payment.status
      }
    })

/**
 * Resolves each account to its linked companies (explicit links first, IBAN
 * fallback) and applies the company filter.
 */
const resolveAccountRows = (
  accounts: Account[],
  links: Awaited<ReturnType<typeof fetchAccountCompanyLinks>>,
  companiesByIban: Map<string, number>,
  companiesById: Awaited<ReturnType<typeof loadCompaniesById>>,
  filterCompanyIds: number[] | undefined
) =>
  accounts
    .filter((account) => !!account.iban)
    .map((account) => {
      const companyIds = resolveCompanyIds(links, companiesByIban, account)
      const companyName =
        companyIds
          .map((id) => companiesById.get(id)?.name)
          .filter((name): name is string => !!name)
          .join(', ') || null
      return { account, companyIds, companyName }
    })
    .filter((row) => {
      if (filterCompanyIds === undefined || filterCompanyIds.length === 0)
        return true
      return row.companyIds.some((id) => filterCompanyIds.includes(id))
    })

const allPaymentsForCompany = async (companyId: number) => {
  const invoiceRows = await db
    .selectFrom('checkout.invoices')
    .select('id')
    .where('companyId', '=', companyId)
    .execute()
  if (invoiceRows.length === 0) return []
  return db
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
      invoiceRows.map((row) => row.id)
    )
    .execute()
}

/**
 * All of a company's payments across its invoices (banktransfer AND PSP rows).
 * The suggestion engine needs the PSP rows' settlementId to resolve a lump-sum
 * payout; the adoption predicate filters banktransfer internally.
 */

export const adminBankTransactionRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: RouterProcedure
}) => ({
  /**
   * Overview: bank transactions straight from the proxy (single source of
   * truth), enriched with the company (by IBAN) and the link status derived
   * from checkout.payments (transaction_reference = 'bank:<txid>').
   */
  listTransactions: procedure
    .input(
      z
        .object({
          companyIds: z.array(z.number()).optional(),
          linked: z.enum(['linked', 'unlinked', 'settled']).optional(),
          suggestionsOnly: z.boolean().optional(),
          from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date')
            .optional(),
          to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date')
            .optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0)
        })
        .optional()
    )
    .query(async ({ input }) => {
      const params: NonNullable<typeof input> = input ?? {
        limit: 50,
        offset: 0
      }
      if (!bankingEnabled()) return { enabled: false, items: [] }
      const client = fastify.banking.getClient()
      if (!client) return { enabled: false, items: [] }

      const accounts = await client.getAccounts()
      const companiesByIban = await loadCompaniesByIban()
      const companiesById = await loadCompaniesById()
      const links = await fetchAccountCompanyLinks(db)
      const accountRows = resolveAccountRows(
        accounts,
        links,
        companiesByIban,
        companiesById,
        params.companyIds
      )

      const bankRefs = await fetchBankPayments(db)
      const linkedInvoiceIds = new Set<number>()
      const paymentByExternalId = new Map<string, BankPaymentRow>()
      for (const payment of [...bankRefs.byRef.values()].flat()) {
        if (payment.invoiceId != null) linkedInvoiceIds.add(payment.invoiceId)
        if (payment.externalId)
          paymentByExternalId.set(payment.externalId, payment)
      }
      const invoiceById = await loadInvoicesByIds([...linkedInvoiceIds])

      const pspSettlements = await client.getPspSettlements()
      const pspPayments = await client.getPspPayments()

      const invoiceIdByUuid = await loadInvoiceIdByUuid(pspPayments)
      // Also load invoices resolved via PSP description UUIDs.
      const pspInvoiceIds = [...invoiceIdByUuid.values()]
      if (pspInvoiceIds.length > 0) {
        const extraInvoices = await loadInvoicesByIds(pspInvoiceIds)
        for (const [id, invoice] of extraInvoices) {
          if (!invoiceById.has(id)) invoiceById.set(id, invoice)
        }
      }

      const companyInvoicesCache = new Map<
        number,
        Awaited<ReturnType<typeof listCompanyInvoices>>
      >()
      const companyPaymentsCache = new Map<number, BankPaymentCandidate[]>()

      const rows: Array<{
        transaction: MatchTransaction
        account: Account
        companyId: number | null
        companyName: string | null
        coverage: 'unlinked' | 'partial' | 'full' | 'settled'
        linkedInvoices: Array<{
          id: number
          uuid: string
          number: string | null
        }>
        suggestion: LinkProposal | null
        psp: PspPayoutDetail | null
      }> = []
      // One-to-one consumption: each settlement may be recognized for at
      // most one bank credit per pass.
      const availableSettlements = [...pspSettlements]
      for (const { account, companyIds, companyName } of accountRows) {
        const transactions = await fetchAccountTransactions(
          client,
          account.id,
          params.from,
          params.to
        )
        for (const apiTransaction of transactions) {
          const reference = `bank:${apiTransaction.id}`
          const linkedRows = bankRefs.byRef.get(reference) ?? []
          const isPspLinked = linkedRows.some(
            (row) =>
              row.settlementId != null || row.paymentServiceProvider != null
          )
          // Read-time recognition: an UNRECONCILED credit that IS a PSP payout is
          // settled by data we already have (checkout.payments +
          // psp_settlements), never a link target. Credits that already carry
          // bank-ref links keep their earned coverage — they never consume a
          // settlement that a genuinely unreconciled payout may need. Legacy
          // applied rows stay settled via the linkedRows OR-condition.
          const matchedSettlement =
            linkedRows.length === 0
              ? matchSettlementForCredit(
                  toMatchTransaction(
                    apiTransaction,
                    account.id,
                    companyIds[0] ?? 0
                  ),
                  availableSettlements
                )
              : null
          if (matchedSettlement) {
            availableSettlements.splice(
              availableSettlements.findIndex(
                (candidate) =>
                  candidate.externalId === matchedSettlement.externalId
              ),
              1
            )
          }
          const isRecognizedPayout = matchedSettlement != null || isPspLinked
          let coverage: 'unlinked' | 'partial' | 'full' | 'settled' = 'unlinked'
          if (linkedRows.length > 0) {
            if (isRecognizedPayout) {
              coverage = 'settled'
            } else {
              const linkedTotal = linkedRows.reduce(
                (sum, row) => sum + (row.amount ?? 0),
                0
              )
              coverage =
                linkedTotal >= parseAmountToCents(apiTransaction.amount)
                  ? 'full'
                  : 'partial'
            }
          } else if (isRecognizedPayout) {
            coverage = 'settled'
          }
          // For settled PSP payouts, resolve the settlement + the payments
          // that make it up (join psp_payments.externalId → checkout.payments).
          let psp: PspPayoutDetail | null = null
          if (isRecognizedPayout) {
            const settlementExternalId =
              matchedSettlement?.externalId ??
              linkedRows.find((row) => row.settlementId != null)?.settlementId
            const settlement = settlementExternalId
              ? pspSettlements.find(
                  (candidate) => candidate.externalId === settlementExternalId
                )
              : undefined
            if (settlement) {
              psp = {
                settlement,
                payments: mapSettlementPayments(
                  pspPayments,
                  settlement.externalId,
                  paymentByExternalId,
                  invoiceIdByUuid,
                  invoiceById
                )
              }
            }
          }
          const linkedInvoices = linkedRows
            .map((row) => {
              const invoice =
                row.invoiceId != null
                  ? invoiceById.get(row.invoiceId)
                  : undefined
              return invoice
                ? { id: invoice.id, uuid: invoice.uuid, number: invoice.number }
                : null
            })
            .filter(
              (
                entry
              ): entry is { id: number; uuid: string; number: string | null } =>
                entry !== null
            )

          let suggestion: LinkProposal | null = null
          if (!isRecognizedPayout) {
            for (const companyId of companyIds) {
              if (!companyInvoicesCache.has(companyId)) {
                companyInvoicesCache.set(
                  companyId,
                  await listCompanyInvoices(db, companyId)
                )
              }
              if (!companyPaymentsCache.has(companyId)) {
                companyPaymentsCache.set(
                  companyId,
                  await allPaymentsForCompany(companyId)
                )
              }
              suggestion = buildLinkProposal({
                transaction: toMatchTransaction(
                  apiTransaction,
                  account.id,
                  companyId
                ),
                invoices: companyInvoicesCache.get(companyId) ?? [],
                payments: companyPaymentsCache.get(companyId) ?? []
              })
              if (suggestion) break
            }
          }

          rows.push({
            transaction: toMatchTransaction(
              apiTransaction,
              account.id,
              companyIds[0] ?? 0
            ),
            account,
            companyId: companyIds[0] ?? null,
            companyName,
            coverage,
            linkedInvoices,
            suggestion,
            psp
          })
        }
      }
      rows.sort((a, b) =>
        (b.transaction.bookingDate ?? '').localeCompare(
          a.transaction.bookingDate ?? ''
        )
      )
      const matchesLinked = (
        row: (typeof rows)[number],
        filter: 'linked' | 'unlinked' | 'settled'
      ): boolean =>
        filter === 'settled'
          ? row.coverage === 'settled'
          : filter === 'unlinked'
            ? row.coverage === 'unlinked'
            : row.coverage !== 'unlinked'
      const linkedFilter = params.linked
      let filtered =
        linkedFilter === undefined
          ? rows
          : rows.filter((row) => matchesLinked(row, linkedFilter))
      if (params.suggestionsOnly) {
        filtered = filtered.filter(
          (row) => row.linkedInvoices.length === 0 && row.suggestion != null
        )
      }
      return {
        enabled: true,
        items: filtered.slice(params.offset, params.offset + params.limit)
      }
    }),

  /**
   * Suggestions tab: actionable unlinked bank credits with matching invoices.
   * Each row has a top suggestion and the candidate invoice uuids for the
   * link dialog.
   */
  listSuggestions: procedure
    .input(
      z
        .object({
          from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date')
            .optional(),
          to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date')
            .optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0)
        })
        .optional()
    )
    .query(async ({ input }) => {
      const params = input ?? { limit: 50, offset: 0 }
      if (!bankingEnabled()) return { enabled: false, items: [] }
      const client = fastify.banking.getClient()
      if (!client) return { enabled: false, items: [] }

      const accounts = await client.getAccounts()
      const links = await fetchAccountCompanyLinks(db)
      const companiesByIban = loadCompaniesByIban()
      const allSuggestions: Array<{
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
      }> = []

      for (const account of accounts) {
        const accountLinks = links.get(account.id)
        const ibanCompany = account.iban
          ? (await companiesByIban).get(normalizeIban(account.iban))
          : undefined
        const companyIds = accountLinks?.length
          ? accountLinks
          : ibanCompany != null
            ? [ibanCompany]
            : []
        if (companyIds.length === 0) continue

        const transactions = await fetchAccountTransactions(
          client,
          account.id,
          params.from,
          params.to
        )

        // Unlinked booked credits
        const bankRefs = await fetchBankPayments(db)
        const linkedTransactions = new Set<string>()
        for (const payment of [...bankRefs.byRef.values()].flat()) {
          if (payment.invoiceId != null) {
            // Mark the transaction reference as linked
          }
        }
        // Mark references that have linked payments
        for (const [ref, rows] of bankRefs.byRef) {
          if (rows.some((r) => r.invoiceId != null)) {
            linkedTransactions.add(ref)
          }
        }

        const companyInvoicesCache = new Map<
          number,
          Awaited<ReturnType<typeof listCompanyInvoices>>
        >()
        const companyPaymentsCache = new Map<number, BankPaymentCandidate[]>()

        for (const apiTx of transactions) {
          if (apiTx.creditDebitIndicator !== 'CRDT') continue
          if ((apiTx.status ?? 'BOOK') !== 'BOOK') continue

          const txRef = `bank:${apiTx.id}`
          if (linkedTransactions.has(txRef)) continue

          for (const companyId of companyIds) {
            if (!companyInvoicesCache.has(companyId)) {
              companyInvoicesCache.set(
                companyId,
                await listCompanyInvoices(db, companyId)
              )
            }
            if (!companyPaymentsCache.has(companyId)) {
              companyPaymentsCache.set(
                companyId,
                await allPaymentsForCompany(companyId)
              )
            }

            const matchTx = toMatchTransaction(apiTx, account.id, companyId)
            const invoices = companyInvoicesCache.get(companyId) ?? []
            const payments = companyPaymentsCache.get(companyId) ?? []

            const result = suggestForCredit({
              transaction: matchTx,
              invoices: invoices,
              payments: payments,
              config: { referenceWindowDays: 14 }
            })

            if (result) {
              const candidateUuids = invoices
                .filter((inv) => inv.companyId === companyId)
                .filter((inv) => inv.status === InvoiceStatus.OPEN)
                .map((inv) => inv.uuid)

              const adoptableIds = payments
                .filter(
                  (p) =>
                    p.method === 'banktransfer' &&
                    p.status === 'paid' &&
                    p.invoiceId != null &&
                    (p.transactionReference === null ||
                      p.transactionReference === '')
                )
                .map((p) => p.invoiceId!)

              allSuggestions.push({
                transaction: matchTx,
                companyId,
                topSuggestion: {
                  invoiceId: result.invoiceId,
                  invoiceNumber:
                    invoices.find((inv) => inv.id === result.invoiceId)
                      ?.number ?? null,
                  score: result.score,
                  evidence: result.evidence
                },
                candidateInvoiceUuids: candidateUuids,
                adoptableInvoiceIds: adoptableIds
              })
              break
            }
          }
        }
      }

      return {
        enabled: true,
        items: allSuggestions.slice(params.offset, params.offset + params.limit)
      }
    }),

  /**
   * Open invoices of one company for the manual link picker. Mirrors the
   * suggestion engine's candidates: OPEN + a real remaining balance, ordered
   * by due date ascending.
   */
  listLinkCandidates: procedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const invoices = await listCompanyInvoices(db, input.companyId)
      const candidates = invoices
        .filter(
          (invoice) =>
            invoice.status === InvoiceStatus.OPEN && invoice.amountDueCents > 0
        )
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      const toCandidate = (invoice: (typeof invoices)[number]) => ({
        id: invoice.id,
        number: invoice.number,
        amountDueCents: invoice.amountDueCents,
        dueDate: invoice.dueDate,
        status: invoice.status,
        companyId: invoice.companyId,
        currency: invoice.currency
      })
      return candidates.map(toCandidate)
    }),

  /**
   * Link a bank credit to invoices (`direct`): creates/adopts one payment
   * per invoice (single or multi split). PSP payouts are never applied —
   * they are recognized read-time in listTransactions.
   */
  applyLink: procedure
    .input(
      z.object({
        mode: z.literal('direct'),
        accountExternalId: z.string(),
        transactionExternalId: z.string(),
        invoiceIds: z.array(z.number()).min(1)
      })
    )
    .mutation(async ({ input }) => {
      const client = fastify.banking.getClient()
      if (!client) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Banking is not configured'
        })
      }
      const invoiceHandler = fastify.checkout?.invoiceHandler
      if (!invoiceHandler) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invoice handler not available'
        })
      }
      const companiesByIban = await loadCompaniesByIban()
      const links = await fetchAccountCompanyLinks(db)
      const accounts = await client.getAccounts()
      const account = accounts.find((row) => row.id === input.accountExternalId)
      if (!account || !account.iban) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' })
      }
      const companyIds = resolveCompanyIds(links, companiesByIban, account)
      if (companyIds.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Account is not linked to a company'
        })
      }

      const transactions = await fetchAccountTransactions(client, account.id)
      const apiTransaction = transactions.find(
        (tx) => tx.id === input.transactionExternalId
      )
      if (!apiTransaction) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bank transaction not found'
        })
      }
      if (apiTransaction.creditDebitIndicator !== 'CRDT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Not an incoming credit'
        })
      }
      if ((apiTransaction.status ?? 'BOOK') !== 'BOOK') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction is not booked'
        })
      }
      if (!isCurrency(apiTransaction.currency)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unsupported currency: ${apiTransaction.currency}`
        })
      }

      const bankRefs = await fetchBankPayments(db)

      if (input.mode === 'direct') {
        const invoices = await Promise.all(
          input.invoiceIds.map((id) => loadInvoiceById(db, id))
        )
        const validInvoices = invoices.filter(
          (invoice): invoice is NonNullable<typeof invoice> =>
            invoice !== undefined
        )
        if (validInvoices.length !== input.invoiceIds.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invoice not found'
          })
        }
        const firstCompanyId = validInvoices[0]!.companyId
        const transaction = toMatchTransaction(
          apiTransaction,
          account.id,
          firstCompanyId!
        )
        const creditAmount = parseAmountToCents(apiTransaction.amount)
        for (const invoice of validInvoices) {
          if (
            invoice.companyId === null ||
            !companyIds.includes(invoice.companyId)
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invoice is not visible to this company'
            })
          }
          if (invoice.status !== InvoiceStatus.OPEN) {
            // Adoption: a paid invoice with an exact-amount manual banktransfer
            // payment can still be coupled to this credit.
            const invoicePayments: BankPaymentCandidate[] = await db
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
              .execute()
            const adoptable = findAdoptablePayment({
              transaction,
              payments: invoicePayments
            })
            if (!adoptable) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Invoice is not open'
              })
            }
          }
        }
        if (validInvoices.length === 1) {
          const singleInvoice = validInvoices[0]!
          if (singleInvoice.status === InvoiceStatus.OPEN) {
            const validation = canApply({ transaction, invoice: singleInvoice })
            if (!validation.ok) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: validation.reason
              })
            }
          }
          // Paid invoice: the adoption validation above confirmed an
          // exact-amount manual payment exists — the write path couples it
          // without creating or re-amounting anything.
        } else {
          const totalDue = validInvoices.reduce(
            (sum, invoice) => sum + invoice.amountDueCents,
            0
          )
          if (totalDue !== creditAmount) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invoice amounts do not sum to the credit amount'
            })
          }
        }
        const links = await linkBankCreditsToInvoices({
          db,
          invoiceHandler,
          invoices: validInvoices,
          transaction,
          bankRefs
        })
        return {
          mode: 'direct' as const,
          results: links.map((link, index) => ({
            invoiceId: validInvoices[index]!.id,
            adopted: link.adopted,
            alreadyLinked: link.alreadyLinked,
            paymentId: link.paymentId ?? null
          }))
        }
      }
      // PSP payouts are never applied here — they are recognized
      // read-time in listTransactions from psp_settlements data.
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Unsupported link mode'
      })
    }),

  getConnections: procedure.query(async () => {
    if (!bankingEnabled()) {
      return { enabled: false, connections: [] }
    }
    const client = fastify.banking.getClient()
    if (!client) {
      return { enabled: false, connections: [] }
    }
    return { enabled: true, connections: await client.getConnections() }
  }),

  getAvailableAccounts: procedure.query(async () => {
    if (!bankingEnabled()) {
      return { enabled: false, accounts: [] }
    }
    const client = fastify.banking.getClient()
    if (!client) {
      return { enabled: false, accounts: [] }
    }
    const accounts = await client.getAccounts()
    const companiesByIban = await loadCompaniesByIban()
    const companiesById = await loadCompaniesById()
    const links = await fetchAccountCompanyLinks(db)
    return {
      enabled: true,
      accounts: accounts.map((account) => {
        const companyIds = resolveCompanyIds(links, companiesByIban, account)
        const companyName =
          companyIds
            .map((id) => companiesById.get(id)?.name)
            .filter((name): name is string => !!name)
            .join(', ') || null
        return { ...account, companyIds, companyName }
      })
    }
  }),

  setAccountCompanies: procedure
    .input(
      z.object({
        accountExternalId: z.string(),
        companyIds: z.array(z.number())
      })
    )
    .mutation(async ({ input }) => {
      const client = fastify.banking.getClient()
      if (!client) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Banking is not configured'
        })
      }
      const accounts = await client.getAccounts()
      const account = accounts.find((row) => row.id === input.accountExternalId)
      if (!account) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' })
      }
      // Validate every company id against the companies table before writing
      // links — zod can only check the shape, not FK existence.
      for (const companyId of input.companyIds) {
        const company = await db
          .selectFrom('companies')
          .select('id')
          .where('id', '=', companyId)
          .executeTakeFirst()
        if (!company) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Unknown company id ${companyId}`
          })
        }
      }
      await setAccountCompanies(db, input.accountExternalId, input.companyIds)
      return { ok: true }
    }),

  requestSync: procedure.mutation(async () => {
    // D15: enqueue on the proxy (returns fast) + schedule the local ingest
    // worker for the same runId, then return immediately.
    const client = fastify.banking.getClient()
    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Banking is not configured'
      })
    }
    const { runId } = await client.syncAll()
    const boss = getBossOrThrow()
    await boss.send(
      'processBankSync',
      { runId },
      { singletonKey: 'process-sync' }
    )
    return { queued: true, runId }
  })
})
