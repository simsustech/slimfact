import { defineQuery, useQuery } from '@pinia/colada'
import { trpc } from '../../trpc.js'
import { ref, computed } from 'vue'

export const useAccountGetInvoicesQuery = defineQuery(() => {
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

  const { data: invoices, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => ['accountGetInvoices', pagination.value],
    query: () =>
      trpc.user.getInvoices.query({
        pagination: pagination.value
      })
  })

  return {
    invoices,
    page,
    rowsPerPage,
    ...rest
  }
})
