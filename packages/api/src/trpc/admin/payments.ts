import { TRPCError } from '@trpc/server'
import { t } from '../index.js'
import * as z from 'zod'
import type { FastifyInstance } from 'fastify'
import type { ExpressionBuilder } from 'kysely'
import { db } from '../../kysely/index.js'
import { PaymentMethod, RefundStatus } from '@modular-api/fastify-checkout'
import type { LedgerRow } from '../../banking/ledger.js'

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
  sources: z.array(z.enum(['payments', 'refunds'])).optional(),
  companyId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
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

/**
 * Parses the text-format timestamps stored by checkout
 * (e.g. "2026-03-01 09:00:00+00").
 */
const parseCheckoutTimestamp = (value: Date | string): number => {
  if (value instanceof Date) return value.getTime()
  const normalized = value.includes('T')
    ? value
    : value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const parsed = new Date(normalized).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

export const adminPaymentsRoutes = ({
  procedure
}: {
  fastify: FastifyInstance
  procedure: RouterProcedure
}) => ({
  /**
   * Unified chronological payments ledger: recognized payments + refunds
   * from checkout (single Kysely unionAll).
   * Bank review rows are gone — they live in the Suggestions tab.
   */
  listPayments: procedure
    .input(inputSchema)
    .query(({ input }) => runLedger(input)),

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
      const yearStart = `${now.getUTCFullYear()}-01-01`
      const today = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(
        now.getUTCDate()
      )}`
      return runLedger({
        ...input,
        from: input.from ?? yearStart,
        to: input.to ?? today
      })
    })
})

const runLedger = async (
  input: z.input<typeof inputSchema>
): Promise<{
  rows: LedgerRow[]
  total: number
  truncated: boolean
  aggregates: {
    inCents: number
    refundedCents: number
    netCents: number
    count: number
    byMethod: Array<{ method: string; cents: number }>
  }
}> => {
  validateWindow(input.from, input.to)

  const sources = input.sources ?? ['payments', 'refunds']
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
      eb.ref('r.paymentServiceProvider').$castTo<string>().as('psp'),
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
    // Company/client filters attribute the money movement through its
    // invoice (payments and refunds both carry the invoice id).
    query = query.leftJoin('checkout.invoices as fi', 'fi.id', 'l.invoiceId')
    if (input.companyId) {
      query = query.where('fi.companyId', '=', input.companyId)
    }
    if (input.clientId) {
      query = query.where('fi.clientId', '=', input.clientId)
    }
    if (input.methods?.length) {
      query = query.where('l.method', 'in', [...input.methods])
    }
    if (input.statuses?.length) {
      const statuses = input.statuses
      // The dropdown lists payment statuses. A settled refund is 'refunded',
      // not 'paid', so selecting 'paid' also includes refunded refunds (the
      // money-out side of a paid payment). All other selections stay
      // payment-only.
      query = query.where((eb: ExpressionBuilder<any, any>) => {
        const paidPayments = eb.and([
          eb('l.kind', '=', 'payment'),
          eb('l.status', 'in', statuses)
        ])
        if (!statuses.includes('paid')) return paidPayments
        return eb.or([
          paidPayments,
          eb.and([
            eb('l.kind', '=', 'refund'),
            eb('l.status', '=', RefundStatus.REFUNDED)
          ])
        ])
      })
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
        dateMs === 0 ? String(raw.date ?? '') : new Date(dateMs).toISOString(),
      dateMs,
      method: String(raw.method),
      amountCents:
        kind === 'refund'
          ? -Math.abs(Number(raw.amountCents))
          : Number(raw.amountCents),
      currency: String(raw.currency),
      status: String(raw.status),
      description: String(raw.description ?? ''),
      transactionReference: (raw.transactionReference as string | null) ?? null,
      externalId: (raw.externalId as string | null) ?? null,
      psp: (raw.psp as string | null) ?? null,
      settlementId: (raw.settlementId as string | null) ?? null,
      invoiceId: (raw.invoiceId as number | null) ?? null,
      invoiceUuid: (raw.invoiceUuid as string | null) ?? null,
      invoiceNumber: ((raw.invoiceNumber as string | null) ?? '') || null,
      clientName: (raw.clientName as string | null) ?? null
    }
  }

  const sortRows = (rows: LedgerRow[]): LedgerRow[] =>
    rows.sort((a, b) =>
      b.dateMs === a.dateMs ? (b.id ?? 0) - (a.id ?? 0) : b.dateMs - a.dateMs
    )

  // SQL rows: filtered, newest-first, capped.
  // SAFETY: Kysely returns arbitrary column types; toLedgerRow validates every field.
  const rawRows = (await filteredBase()
    .select(selectLedgerColumns)
    .orderBy('l.date', 'desc')
    .orderBy('l.id', 'desc')
    .limit(MAX_ROWS)
    .execute()) as Record<string, unknown>[]
  const sqlRows = rawRows.map(toLedgerRow)

  const merged = sortRows(sqlRows)

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
    truncated: merged.length >= MAX_ROWS,
    aggregates: {
      inCents: paidIn,
      refundedCents: refunded,
      netCents: paidIn - refunded,
      count: merged.length,
      byMethod: [...byMethodMap.entries()].map(([method, cents]) => ({
        method,
        cents
      }))
    }
  }
}
