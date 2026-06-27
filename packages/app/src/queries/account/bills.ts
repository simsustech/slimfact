import { defineQuery, useQuery } from '@pinia/colada'
import { trpc } from '../../trpc.js'
import { ref, computed } from 'vue'

export const useAccountGetBillsQuery = defineQuery(() => {
  const page = ref(1)
  const rowsPerPage = ref(5)

  const pagination = computed<{
    limit: number
    offset: number
    sortBy: 'id' | 'totalIncludingTax' | 'createdAt'
    descending: boolean
  }>(() => ({
    limit: rowsPerPage.value,
    offset: (page.value - 1) * rowsPerPage.value,
    sortBy: 'id',
    descending: true
  }))

  const { data: bills, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => ['accountGetBills', pagination.value],
    query: () =>
      trpc.user.getBills.query({
        pagination: pagination.value
      })
  })

  return {
    bills,
    page,
    rowsPerPage,
    ...rest
  }
})
