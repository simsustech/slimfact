import { type FastifyInstance } from 'fastify'

import { t } from '../index.js'
import { agingLabelForReminderCount } from '../../dashboard/aging.js'
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  endOfDay
} from 'date-fns'
import { InvoiceStatus } from '@modular-api/fastify-checkout'
import {
  getDashboardStatsInput,
  getDashboardActivityInput
} from '../../zod/dashboard.js'

// Pick a time-bucket granularity based on the date-range span:
// day for <=31d, week for <=12w (~84d), month otherwise.
export const pickGranularity = (
  dateFrom: string,
  dateTo: string
): 'day' | 'week' | 'month' => {
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  const days = Math.max(
    0,
    Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  )
  if (days <= 31) return 'day'
  if (days <= 84) return 'week'
  return 'month'
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
            companyName: string | null
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
          granularity: 'day' | 'week' | 'month'
        }) => Promise<{
          labels: string[]
          series: { status: InvoiceStatus; data: number[] }[]
        }>
        getOutstandingTotal: (args: {
          statuses?: InvoiceStatus[]
          companyIds?: number[]
        }) => Promise<number>
      }

      const granularity = pickGranularity(dateFrom, dateTo)
      const [statusCounts, overdueAging, paidRevenueSeries, outstandingTotal] =
        await Promise.all([
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
            granularity
          }),
          handler.getOutstandingTotal({
            statuses: [InvoiceStatus.OPEN],
            ...(companyIds && { companyIds })
          })
        ])

      const overdueAgingLabeled = overdueAging.map((row) => ({
        ...row,
        label: agingLabelForReminderCount(row.reminderCount)
      }))

      return {
        statusCounts,
        overdueAging: overdueAgingLabeled,
        paidRevenueSeries,
        outstandingTotal
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
