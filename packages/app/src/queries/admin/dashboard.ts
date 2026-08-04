import { useQuery } from '@pinia/colada'
import type { Ref } from 'vue'
import { trpc } from '../../trpc.js'

export type ActivityEventType =
  | 'invoiceOpened'
  | 'billCreated'
  | 'payment'
  | 'reminder'
  | 'exhortation'

export interface DashboardStatsParams {
  companyIds: Ref<number[]>
  dateFrom: Ref<string>
  dateTo: Ref<string>
}

export const useAdminGetDashboardStatsQuery = (
  params: DashboardStatsParams
) => {
  const { companyIds, dateFrom, dateTo } = params

  const { data: stats, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => [
      'adminGetDashboardStats',
      companyIds.value,
      dateFrom.value,
      dateTo.value
    ],
    query: () =>
      trpc.admin.getDashboardStats.query({
        companyIds: companyIds.value,
        dateFrom: dateFrom.value,
        dateTo: dateTo.value
      })
  })

  return {
    stats,
    ...rest
  }
}

export interface DashboardActivityParams {
  companyIds: Ref<number[]>
  eventTypes: Ref<ActivityEventType[]>
  limit: Ref<number>
}

export const useAdminGetDashboardActivityQuery = (
  params: DashboardActivityParams
) => {
  const { companyIds, eventTypes, limit } = params

  const { data: activity, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => [
      'adminGetDashboardActivity',
      companyIds.value,
      eventTypes.value,
      limit.value
    ],
    query: () =>
      trpc.admin.getDashboardActivity.query({
        companyIds: companyIds.value,
        eventTypes: eventTypes.value,
        limit: limit.value
      })
  })

  return {
    activity,
    ...rest
  }
}
