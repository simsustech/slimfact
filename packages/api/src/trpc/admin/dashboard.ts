import { type FastifyInstance } from 'fastify'

import { t } from '../index.js'
import { agingLabelForReminderCount } from '../../dashboard/aging.js'
import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  endOfDay,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear
} from 'date-fns'
import { InvoiceStatus } from '@modular-api/fastify-checkout'
import {
  getDashboardStatsInput,
  getDashboardActivityInput
} from '../../zod/dashboard.js'

// Pick a time-bucket granularity based on the date-range span so the axis
// always shows the whole period with a sensible number of points:
// day for <=10d (week view), week (numbers) for <=45d (month view),
// month for <=200d (quarter view), quarter otherwise (year view).
export type RevenueGranularity = 'day' | 'week' | 'month' | 'quarter'

export const pickGranularity = (
  dateFrom: string,
  dateTo: string
): RevenueGranularity => {
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  const days = Math.max(
    0,
    Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  )
  if (days <= 10) return 'day'
  if (days <= 45) return 'week'
  if (days <= 200) return 'month'
  return 'quarter'
}

// Every time-bucket start in [dateFrom, dateTo] for a granularity,
// truncated to the bucket boundary (Monday for weeks, 1st for months,
// quarter start), matching Postgres date_trunc so the revenue grouping
// aligns exactly.
export const bucketStarts = (
  dateFrom: string,
  dateTo: string,
  granularity: RevenueGranularity
): string[] => {
  const from = parseISO(dateFrom)
  const to = parseISO(dateTo)
  let cursor =
    granularity === 'day'
      ? startOfDay(from)
      : granularity === 'week'
        ? startOfWeek(from, { weekStartsOn: 1 })
        : granularity === 'month'
          ? startOfMonth(from)
          : startOfQuarter(from)
  const step =
    granularity === 'day'
      ? addDays
      : granularity === 'week'
        ? addWeeks
        : granularity === 'month'
          ? addMonths
          : addQuarters
  const starts: string[] = []
  while (cursor <= to) {
    starts.push(format(cursor, 'yyyy-MM-dd'))
    cursor = step(cursor, 1)
  }
  return starts
}

// Display label for a bucket start: YYYY-MM-DD, ISO week (2026-W32),
// YYYY-MM or YYYY-Qn.
export const bucketLabel = (
  start: string,
  granularity: RevenueGranularity
): string => {
  const date = parseISO(start)
  if (granularity === 'day') return start
  if (granularity === 'week')
    return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`
  if (granularity === 'month') return start.slice(0, 7)
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
}

// Last day (inclusive) of a time bucket whose first day is `start`
// (YYYY-MM-DD). Used to turn a clicked chart bucket into a date range.
export const bucketEndDate = (
  start: string,
  granularity: RevenueGranularity
): string => {
  const [year, month, day] = start.split('-').map(Number)
  switch (granularity) {
    case 'day':
      return start
    case 'week':
      return toIsoDate(new Date(Date.UTC(year, month - 1, day + 6)))
    case 'month':
      // Day 0 of the month AFTER the bucket month = last day of the month.
      return toIsoDate(new Date(Date.UTC(year, month, 0)))
    case 'quarter': {
      // `month` is the first month of the quarter (1, 4, 7 or 10); day 0 of
      // the month after the third month = last day of the quarter.
      return toIsoDate(new Date(Date.UTC(year, month + 2, 0)))
    }
  }
}

export const adminDashboardRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  getDashboardStats: procedure
    .input(getDashboardStatsInput)
    .query(async ({ input }) => {
      const { companyIds, dateFrom, dateTo } = input
      if (!fastify.checkout?.invoiceHandler) {
        throw new Error('No invoice handler')
      }

      const handler = fastify.checkout.invoiceHandler as unknown as {
        getInvoiceStatusCounts: (args?: { companyIds?: number[] }) => Promise<
          {
            companyId: number | null
            companyName: string | null
            status: InvoiceStatus
            count: number
            totalAmount: number
          }[]
        >
        getInvoiceOverdueAging: (args?: { companyIds?: number[] }) => Promise<
          {
            companyId: number | null
            reminderCount: number
            count: number
            totalAmount: number
          }[]
        >
        getPaidRevenue: (args: {
          statuses?: InvoiceStatus[]
          companyIds?: number[]
          dateFrom: string
          dateTo: string
          granularity: 'day' | 'week' | 'month' | 'quarter'
          buckets: { start: string }[]
        }) => Promise<{
          buckets: { start: string }[]
          series: { status: InvoiceStatus; data: number[] }[]
        }>
        getUpcomingIncome: (args: { companyIds?: number[] }) => Promise<{
          count: number
          totalAmount: number
          next: {
            documentUuid: string
            documentNumber: string | null
            clientName: string | null
            amount: number
            dueDate: string | null
          }[]
        }>
        getPaymentMethodSplit: (args: {
          companyIds?: number[]
          dateFrom: string
          dateTo: string
        }) => Promise<{ method: string; totalAmount: number; count: number }[]>
      }

      const granularity = pickGranularity(dateFrom, dateTo)
      const [
        statusCounts,
        overdueAging,
        paidRevenueSeries,
        upcomingIncome,
        paymentMethodSplit
      ] = await Promise.all([
        handler.getInvoiceStatusCounts(companyIds && { companyIds }),
        handler.getInvoiceOverdueAging(companyIds && { companyIds }),
        handler.getPaidRevenue({
          statuses: [
            InvoiceStatus.PAID,
            InvoiceStatus.BILL,
            InvoiceStatus.RECEIPT
          ],
          ...(companyIds && { companyIds }),
          dateFrom,
          dateTo,
          granularity,
          buckets: bucketStarts(dateFrom, dateTo, granularity).map((start) => ({
            start
          }))
        }),
        handler.getUpcomingIncome(companyIds && { companyIds }),
        handler.getPaymentMethodSplit({
          ...(companyIds && { companyIds }),
          dateFrom,
          dateTo
        })
      ])

      const overdueAgingLabeled = overdueAging.map((row) => ({
        ...row,
        label: agingLabelForReminderCount(row.reminderCount)
      }))
      // Compose the labels from the bucket starts, and turn every start into
      // an inclusive {start, end} date range so the app can zoom into a
      // clicked chart bucket.
      const paidRevenueSeriesWithRanges = paidRevenueSeries
        ? {
            ...paidRevenueSeries,
            labels: paidRevenueSeries.buckets.map((bucket) =>
              bucketLabel(bucket.start, granularity)
            ),
            buckets: paidRevenueSeries.buckets.map((bucket) => ({
              start: bucket.start,
              end: bucketEndDate(bucket.start, granularity)
            }))
          }
        : paidRevenueSeries

      return {
        statusCounts,
        overdueAging: overdueAgingLabeled,
        paidRevenueSeries: paidRevenueSeriesWithRanges,
        upcomingIncome,
        paymentMethodSplit,
        granularity
      }
    }),

  getDashboardActivity: procedure
    .input(getDashboardActivityInput)
    .query(async ({ input }) => {
      const { companyIds, eventTypes, limit } = input
      if (!fastify.checkout?.invoiceHandler) {
        throw new Error('No invoice handler')
      }

      const handler = fastify.checkout.invoiceHandler as unknown as {
        getActivityFeed: (args: {
          companyIds?: number[]
          eventTypes?: string[]
          limit?: number
        }) => Promise<
          {
            type: string
            documentUuid: string
            clientName: string | null
            amount: number
            timestamp: string
          }[]
        >
      }

      const entries = await handler.getActivityFeed({
        ...(companyIds && { companyIds }),
        ...(eventTypes && { eventTypes }),
        limit
      })
      return { entries }
    })
})

export type DashboardDateRangePreset =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const dashboardDateRangeForPreset = (
  preset: DashboardDateRangePreset,
  now: Date = new Date()
): { dateFrom: string; dateTo: string } => {
  let start: Date
  switch (preset) {
    case 'today':
      start = startOfDay(now)
      break
    case 'week':
      start = startOfWeek(now, { weekStartsOn: 1 })
      break
    case 'month':
      start = startOfMonth(now)
      break
    case 'quarter':
      start = startOfQuarter(now)
      break
    case 'year':
      start = startOfYear(now)
      break
    default:
      start = startOfDay(now)
      break
  }
  return {
    dateFrom: toIsoDate(start),
    dateTo: toIsoDate(endOfDay(now))
  }
}
