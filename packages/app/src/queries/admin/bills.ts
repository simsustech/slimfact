import { defineQuery, useQuery } from '@pinia/colada'
import { validIsoDate } from '@slimfact/tools'
import { ref, computed } from 'vue'
import { trpc } from '../../trpc.js'
import { InvoiceStatus } from '@modular-api/fastify-checkout/types'

export const useAdminGetBillsQuery = defineQuery(() => {
  const companyId = ref(NaN)
  const clientId = ref(NaN)
  const clientDetails = ref({
    name: null as string | null
  })
  const page = ref(1)
  const rowsPerPage = ref(5)
  const uuids = ref<string[] | undefined>()
  const paid = ref()
  const startDate = ref<string | null>(null)
  const endDate = ref<string | null>(null)
  const pagination = computed<{
    limit: number
    offset: number
    sortBy: 'id' | 'companyId' | 'clientId' | 'totalIncludingTax'
    descending: boolean
  }>(() => ({
    limit: rowsPerPage.value,
    offset: (page.value - 1) * rowsPerPage.value,
    sortBy: 'id',
    descending: true
  }))

  const { data: bills, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => [
      'adminGetBills',
      clientId.value,
      companyId.value,
      clientDetails.value,
      paid.value,
      validIsoDate(startDate.value),
      validIsoDate(endDate.value),
      pagination.value,
      {
        uuids:
          companyId.value || clientId.value || clientDetails.value.name
            ? undefined
            : uuids.value
      }
    ],
    query: () =>
      trpc.admin.getInvoices.query({
        companyId: companyId.value,
        clientId: clientId.value,
        clientDetails: clientDetails.value,
        status: InvoiceStatus.BILL,
        pagination: pagination.value,
        paid: paid.value,
        startDate: validIsoDate(startDate.value),
        endDate: validIsoDate(endDate.value),
        uuids:
          companyId.value || clientId.value || clientDetails.value.name
            ? undefined
            : uuids.value
      })
  })
  return {
    bills,
    companyId,
    clientId,
    clientDetails,
    page,
    rowsPerPage,
    uuids,
    paid,
    startDate,
    endDate,
    ...rest
  }
})
