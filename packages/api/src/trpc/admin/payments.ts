import { TRPCError } from '@trpc/server'
import { t } from '../index.js'
import * as z from 'zod'
import type { FastifyInstance } from 'fastify'
import type { ExpressionBuilder } from 'kysely'
import { db } from '../../kysely/index.js'
import { bankingEnabled } from '../../config/env.js'
import { PaymentMethod } from '@modular-api/fastify-checkout'
import {
  fetchUnmatchedCredits,
  parseCheckoutTimestamp,
  type LedgerRow
} from '../../banking/ledger.js'

const MAX_ROWS = 10000
const MAX_WINDOW_DAYS = 366
const DEFAULT_PAGE_SIZE = 50

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type RouterProcedure = typeof t.procedure

const inputSchema = z.object({
  q: z.string().max(200).optional(),
  from: z.string().regex(DATE_RE, 'Expected YYYY-MM-DD date').optional(),
  to: z.string().regex(DATE_RE, 'Expected YYYY-MM-DD date').optional(),
  methods: z.array(z.nativeEnum(PaymentMethod)).optional(),
  statuses: z.array(z.string()).optional(),
  psps: z.array(z.string()).optional(),
  sources: z.array(z.enum(['payments', 'refunds', 'bank'])).optional(),
  limit: z.number().min(1).max(200).default(DEFAULT_PAGE_SIZE),
  offset: z.number().min(0).default(0)
})

/** Rejects invalid or oversized (> 366 days) windows before touching the DB. */
const validateWindow = (from?: string, to?: string): void => {
  if (!from || !to) return
  const spanDays = (Date.parse(to) - Date.parse(from)) / 86400000
  if (!Number.isFinite(spanDays) || spanDays < 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid date range' })
  }
  if (spanDays > MAX_WINDOW_DAYS) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Date range cannot exceed ${MAX_WINDOW_DAYS} days — narrow your range`
    })
  }
}

/** concat(numberPrefix, number) over the joined invoice, NULL-safe. */
const invoiceNumberExpression = (eb: ExpressionBuilder<any, any>) =>
  eb.fn('concat', [
    eb.fn.coalesce(eb.ref('l.invoiceNumberPrefix'), eb.val('')),
    eb.fn.coalesce(
      eb.cast(eb.ref('l.invoiceNumberValue'), 'varchar'),
      eb.val('')
    )
  ])

export const adminPaymentsRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: RouterProcedure
}) => ({
  /**
   * Unified chronological payments ledger: recognized payments + refunds
   * from checkout (single Kysely unionAll), plus — when open-banking is
   * configured — unmatched incoming credits as read-only review rows.
   */
  listPayments: procedure
    .input(inputSchema)
    .query(({ input }) => runLedger(input, { fetchAll: false, fastify })),

  /**
   * CSV source data for the client-side export: same filters as the ledger,
   * server-side from/to defaults (current month), hard-capped at MAX_ROWS
   * with a truncated flag so the UI can ask the user to narrow the range.
   */
  exportPayments: procedure
    .input(
      inputSchema.extend({
        limit: z.number().optional(),
        offset: z.number().optional()
      })
    )
    .query(async ({ input }) => {
      const now = new Date()
      const pad = (value: number) => String(value).padStart(2, '0')
      const monthStart = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-01`
      const today = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(
        now.getUTCDate()
      )}`
      return runLedger(
        { ...input, from: input.from ?? monthStart, to: input.to ?? today },
        { fetchAll: true, fastify }
      )
    })
})

const runLedger = async (
  input: z.infer<typeof inputSchema>,
  { fetchAll, fastify }: { fetchAll: boolean; fastify: FastifyInstance }
): Promise<{
  rows: LedgerRow[]
  total: number
  truncated: boolean
  aggregates: {
    inCents: number
    refundedCents: number
    netCents: number
    count: number
    unallocatedCents: number
    byMethod: Array<{ method: string; cents: number }>
  }
}> => {
  {
    validateWindow(input.from, input.to)

    const sources = input.sources ?? ['payments', 'refunds', 'bank']
    const includePayments = sources.includes('payments')
    const includeRefunds = sources.includes('refunds')

    /* -------------------------------------------------------------- */
    /* Branch builders (identical column lists for a clean unionAll)   */
    /* -------------------------------------------------------------- */

    const paymentsBranch = db
      .selectFrom('checkout.payments as p')
      .leftJoin('checkout.invoices as i', 'i.id', 'p.invoiceId')
      .leftJoin('clients as c', 'c.id', 'i.clientId')
      .select((eb) => [
        eb.val('payment').as('kind'),
        eb.ref('p.id').as('id'),
        eb.ref('p.uuid').as('uuid'),
        eb.fn
          .coalesce(
            eb.ref('p.paidAt'),
            eb.cast(eb.ref('p.createdAt'), 'timestamptz')
          )
          .as('date'),
        eb.ref('p.method').$castTo<string>().as('method'),
        eb.ref('p.amount').as('amountCents'),
        eb.ref('p.currency').$castTo<string>().as('currency'),
        eb.ref('p.status').$castTo<string>().as('status'),
        eb.ref('p.description').as('description'),
        eb.ref('p.transactionReference').as('transactionReference'),
        eb.ref('p.externalId').as('externalId'),
        eb.ref('p.paymentServiceProvider').$castTo<string>().as('psp'),
        eb.ref('p.settlementId').as('settlementId'),
        eb.ref('p.invoiceId').as('invoiceId'),
        eb.ref('i.uuid').as('invoiceUuid'),
        eb.ref('i.numberPrefix').as('invoiceNumberPrefix'),
        eb.ref('i.number').as('invoiceNumberValue'),
        eb.ref('c.companyName').as('clientName')
      ])

    const refundsBranch = db
      .selectFrom('checkout.refunds as r')
      .innerJoin('checkout.payments as rp', 'rp.id', 'r.paymentId')
      .leftJoin('checkout.invoices as i', 'i.id', 'rp.invoiceId')
      .leftJoin('clients as c', 'c.id', 'i.clientId')
      .select((eb) => [
        eb.val('refund').as('kind'),
        eb.ref('r.id').as('id'),
        eb.ref('r.uuid').as('uuid'),
        eb.cast(eb.ref('r.createdAt'), 'timestamptz').as('date'),
        eb.val('refund').as('method'),
        eb.ref('r.amount').as('amountCents'),
        eb.ref('r.currency').as('currency'),
        eb.ref('r.status').$castTo<string>().as('status'),
        eb.ref('r.description').as('description'),
        eb.ref('rp.transactionReference').as('transactionReference'),
        eb.ref('r.externalId').as('externalId'),
        eb.ref('r.paymentServiceProvider').as('psp'),
        eb.ref('rp.settlementId').as('settlementId'),
        eb.ref('rp.invoiceId').as('invoiceId'),
        eb.ref('i.uuid').as('invoiceUuid'),
        eb.ref('i.numberPrefix').as('invoiceNumberPrefix'),
        eb.ref('i.number').as('invoiceNumberValue'),
        eb.ref('c.companyName').as('clientName')
      ])

    const ledgerSource =
      includePayments && includeRefunds
        ? paymentsBranch.unionAll(refundsBranch)
        : includeRefunds
          ? refundsBranch
          : paymentsBranch

    /* -------------------------------------------------------------- */
    /* Shared filtered wrapper                                         */
    /* -------------------------------------------------------------- */

    const filteredBase = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = db.selectFrom(ledgerSource.as('l'))
      if (input.methods?.length) {
        query = query.where('l.method', 'in', [...input.methods])
      }
      if (input.statuses?.length) {
        query = query.where('l.status', 'in', input.statuses)
      }
      if (input.psps?.length) {
        query = query.where('l.psp', 'in', input.psps)
      }
      if (input.from) {
        query = query.where('l.date', '>=', input.from)
      }
      if (input.to) {
        query = query.where('l.date', '<=', `${input.to} 23:59:59.999`)
      }
      if (input.q) {
        const needle = `%${input.q}%`
        query = query.where((eb: ExpressionBuilder<any, any>) =>
          eb.or([
            eb('l.description', 'ilike', needle),
            eb('l.transactionReference', 'ilike', needle),
            eb('l.externalId', 'ilike', needle),
            eb('l.clientName', 'ilike', needle),
            eb(invoiceNumberExpression(eb), 'ilike', needle)
          ])
        )
      }
      return query
    }

    const selectLedgerColumns = (eb: ExpressionBuilder<any, any>) => [
      eb.ref('l.kind').as('kind'),
      eb.ref('l.id').as('id'),
      eb.ref('l.uuid').as('uuid'),
      eb.ref('l.date').as('date'),
      eb.ref('l.method').as('method'),
      eb.ref('l.amountCents').as('amountCents'),
      eb.ref('l.currency').as('currency'),
      eb.ref('l.status').as('status'),
      eb.ref('l.description').as('description'),
      eb.ref('l.transactionReference').as('transactionReference'),
      eb.ref('l.externalId').as('externalId'),
      eb.ref('l.psp').as('psp'),
      eb.ref('l.settlementId').as('settlementId'),
      eb.ref('l.invoiceId').as('invoiceId'),
      eb.ref('l.invoiceUuid').as('invoiceUuid'),
      invoiceNumberExpression(eb).as('invoiceNumber'),
      eb.ref('l.clientName').as('clientName')
    ]

    const toLedgerRow = (raw: Record<string, unknown>): LedgerRow => {
      const kind = raw.kind as LedgerRow['kind']
      const dateMs = parseCheckoutTimestamp(raw.date as Date)
      return {
        kind,
        id: (raw.id as number | null) ?? null,
        uuid: (raw.uuid as string | null) ?? null,
        date:
          dateMs === 0
            ? String(raw.date ?? '')
            : new Date(dateMs).toISOString(),
        dateMs,
        method: String(raw.method),
        amountCents:
          kind === 'refund'
            ? -Math.abs(Number(raw.amountCents))
            : Number(raw.amountCents),
        currency: String(raw.currency),
        status: String(raw.status),
        description: String(raw.description ?? ''),
        transactionReference:
          (raw.transactionReference as string | null) ?? null,
        externalId: (raw.externalId as string | null) ?? null,
        psp: (raw.psp as string | null) ?? null,
        settlementId: (raw.settlementId as string | null) ?? null,
        invoiceId: (raw.invoiceId as number | null) ?? null,
        invoiceUuid: (raw.invoiceUuid as string | null) ?? null,
        invoiceNumber: ((raw.invoiceNumber as string | null) ?? '') || null,
        clientName: (raw.clientName as string | null) ?? null,
        bankSynced: String(raw.transactionReference ?? '').startsWith('bank:')
      }
    }

    const client = fastify.banking.getClient()
    const wantBank = sources.includes('bank') && bankingEnabled() && !!client

    const sortRows = (rows: LedgerRow[]): LedgerRow[] =>
      rows.sort((a, b) =>
        b.dateMs === a.dateMs ? (b.id ?? 0) - (a.id ?? 0) : b.dateMs - a.dateMs
      )

    const paidCaseSum = (eb: ExpressionBuilder<any, any>) =>
      eb.cast(
        eb.fn.sum<number>(
          eb
            .case()
            .when('l.status', '=', 'paid')
            .then(eb.ref('l.amountCents'))
            .else(0)
            .end()
        ),
        'integer'
      )

    if (!wantBank) {
      const [rawCount, rawRows, totalsRaw, byMethodRaw] = await Promise.all([
        filteredBase()
          .select((eb: ExpressionBuilder<any, any>) =>
            eb.fn.countAll().as('count')
          )
          .execute(),
        filteredBase()
          .select(selectLedgerColumns)
          .orderBy('l.date', 'desc')
          .orderBy('l.id', 'desc')
          .limit(fetchAll ? MAX_ROWS : input.limit)
          .offset(fetchAll ? 0 : input.offset)
          .execute(),
        filteredBase()
          .select((eb: ExpressionBuilder<any, any>) => [
            paidCaseSum(eb).as('inCents'),
            eb
              .cast(
                eb.fn.sum<number>(
                  eb
                    .case()
                    .when('l.kind', '=', 'refund')
                    .then(eb.ref('l.amountCents'))
                    .else(0)
                    .end()
                ),
                'integer'
              )
              .as('refundedCents')
          ])
          .executeTakeFirst(),
        filteredBase()
          .select((eb: ExpressionBuilder<any, any>) => [
            eb.ref('l.method').as('method'),
            paidCaseSum(eb).as('cents')
          ])
          .where('l.kind', '=', 'payment')
          .groupBy('l.method')
          .execute()
      ])

      const rows = (rawRows as unknown as Record<string, unknown>[]).map(
        toLedgerRow
      )
      const totalCount = Number(
        (rawCount[0] as unknown as { count: number | string } | undefined)
          ?.count ?? 0
      )
      const inCents = Number(totalsRaw?.inCents ?? 0)
      const refundedCents = Number(totalsRaw?.refundedCents ?? 0)

      return {
        rows,
        total: totalCount,
        truncated: fetchAll && totalCount > rows.length,
        aggregates: {
          inCents,
          refundedCents,
          netCents: inCents - refundedCents,
          count: totalCount,
          unallocatedCents: 0,
          byMethod: byMethodRaw.map(
            (entry: { method: string; cents: number | string }) => ({
              method: entry.method,
              cents: Number(entry.cents)
            })
          )
        }
      }
    }

    /* -------------------------------------------------------------- */
    /* Banking enabled: route-layer merge (proxy is an external store) */
    /* -------------------------------------------------------------- */

    const rawRows = (await filteredBase()
      .select(selectLedgerColumns)
      .limit(MAX_ROWS)
      .execute()) as unknown as Record<string, unknown>[]
    const sqlRows = rawRows.map(toLedgerRow)

    let bankRows: LedgerRow[] = []
    try {
      bankRows = await fetchUnmatchedCredits({
        db,
        client: client!,
        from: input.from,
        to: input.to
      })
    } catch (error) {
      fastify.log.warn(
        `payments ledger: bank branch unavailable: ${String(error)}`
      )
    }

    // The proxy source sits outside the SQL wrapper, so the same filters
    // are applied here — otherwise bank rows would ignore q/date/status.
    const needle = input.q?.toLowerCase()
    bankRows = bankRows.filter((row) => {
      if (
        needle &&
        ![row.description, row.transactionReference ?? '', row.clientName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(needle)
      ) {
        return false
      }
      if (input.from && row.date && row.date < input.from) return false
      if (input.to && row.date && row.date > `${input.to}~`) return false
      if (input.statuses?.length && !input.statuses.includes(row.status))
        return false
      if (input.psps?.length) return false
      if (input.methods?.length) return false
      return true
    })

    const merged = sortRows([...sqlRows, ...bankRows])
    // Export calls omit limit/offset entirely (undefined must not become NaN).
    const start = input.offset ?? 0
    const end = input.limit === undefined ? undefined : start + input.limit
    const page = merged.slice(start, end)

    const paidIn = sqlRows
      .filter((row) => row.status === 'paid')
      .reduce((sum, row) => sum + row.amountCents, 0)
    const refunded = sqlRows
      .filter((row) => row.kind === 'refund')
      .reduce((sum, row) => sum + Math.abs(row.amountCents), 0)
    const unallocatedCents = bankRows.reduce(
      (sum, row) => sum + row.amountCents,
      0
    )

    const byMethodMap = new Map<string, number>()
    for (const row of sqlRows) {
      if (row.kind !== 'payment' || row.status !== 'paid') continue
      byMethodMap.set(
        row.method,
        (byMethodMap.get(row.method) ?? 0) + row.amountCents
      )
    }

    return {
      rows: page,
      total: merged.length,
      truncated: rawRows.length >= MAX_ROWS,
      aggregates: {
        inCents: paidIn,
        refundedCents: refunded,
        netCents: paidIn - refunded,
        count: merged.length,
        unallocatedCents,
        byMethod: [...byMethodMap.entries()].map(([method, cents]) => ({
          method,
          cents
        }))
      }
    }
  }
}
