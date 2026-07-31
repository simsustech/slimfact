import { defineQuery, useQuery } from '@pinia/colada'
import { ref } from 'vue'
import { trpc } from '../../trpc.js'

export const useAdminGetDashboardStatsQuery = defineQuery(() => {
  const companyIds = ref<number[]>([])
  const dateFrom = ref<string>('2025-01-01')
  const dateTo = ref<string>('2025-12-31')

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
    companyIds,
    dateFrom,
    dateTo,
    ...rest
  }
})

export const useAdminGetDashboardActivityQuery = defineQuery(() => {
  const companyIds = ref<number[]>([])
  const eventTypes = ref<string[]>([])
  const limit = ref(20)

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
    companyIds,
    eventTypes,
    limit,
    ...rest
  }
})
