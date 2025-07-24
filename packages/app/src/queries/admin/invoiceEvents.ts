import { defineQuery, useQuery } from '@pinia/colada'
import { trpc } from '../../trpc.js'
import { ref } from 'vue'

export const useAdminGetInvoiceEventsQuery = defineQuery(() => {
  const invoiceId = ref<number>(NaN)
  const { data: invoiceEvents, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => ['adminGetInvoiceEvents', invoiceId.value],
    query: () =>
      trpc.admin.getInvoiceEvents.query({
        invoiceId: invoiceId.value
      })
  })
  return {
    invoiceEvents,
    invoiceId,
    ...rest
  }
})

export const useAdminGetInvoiceEventsByInvoiceIdsQuery = defineQuery(() => {
  const invoiceIds = ref<number[]>([])
  const { data: invoiceEvents, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => ['adminGetInvoiceEvents', { invoiceIds: invoiceIds.value }],
    query: () =>
      trpc.admin.getInvoiceEventsByInvoiceIds.query({
        invoiceIds: invoiceIds.value
      }),
    placeholderData: () => []
  })
  return {
    invoiceEvents,
    invoiceIds,
    ...rest
  }
})
