import { useMutation, defineQuery, useQuery } from '@pinia/colada'
import { trpc } from '../../trpc.js'
import type { NewPayment, RawNewInvoice } from '@modular-api/fastify-checkout'
import { ref, computed } from 'vue'
import { InvoiceStatus } from '@modular-api/fastify-checkout/types'

export const useAdminGetInvoicesQuery = defineQuery(() => {
  const companyId = ref(NaN)
  const clientId = ref(NaN)
  const clientDetails = ref({
    name: null as string | null
  })
  const page = ref(1)
  const rowsPerPage = ref(5)
  const uuids = ref<string[] | undefined>()
  const paid = ref()
  const invoiceStatus = ref<
    | InvoiceStatus.OPEN
    | InvoiceStatus.PAID
    | InvoiceStatus.CONCEPT
    | InvoiceStatus.CANCELED
  >()
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

  const { data: invoices, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => [
      'adminGetInvoices',
      clientId.value,
      companyId.value,
      clientDetails.value,
      invoiceStatus.value,
      paid.value,
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
        status: invoiceStatus.value,
        pagination: pagination.value,
        paid: paid.value,
        uuids:
          companyId.value || clientId.value || clientDetails.value.name
            ? undefined
            : uuids.value
      })
  })
  return {
    invoices,
    companyId,
    clientId,
    clientDetails,
    invoiceStatus,
    page,
    rowsPerPage,
    uuids,
    paid,
    ...rest
  }
})

export const useAdminCreateInvoiceMutation = () => {
  const { ...rest } = useMutation({
    mutation: (invoice: RawNewInvoice) =>
      trpc.admin.createInvoice.mutate(invoice)
  })
  return {
    ...rest
  }
}

export const useAdminUpdateInvoiceMutation = () => {
  const { ...rest } = useMutation({
    mutation: (invoice: RawNewInvoice) =>
      trpc.admin.updateInvoice.mutate(invoice)
  })
  return {
    ...rest
  }
}

export const useAdminAddPaymentToInvoiceMutation = () => {
  const { ...rest } = useMutation({
    mutation: ({ id, payment }: { id: number; payment: NewPayment }) =>
      trpc.admin.addPaymentToInvoice.mutate({ id, payment })
  })
  return {
    ...rest
  }
}

export const useAdminCancelInvoiceMutation = () => {
  const { ...rest } = useMutation({
    mutation: ({ id }: { id: number }) =>
      trpc.admin.cancelInvoice.mutate({ id })
  })
  return {
    ...rest
  }
}

export const useAdminRefundInvoiceMutation = () => {
  const { ...rest } = useMutation({
    mutation: (id: number) =>
      trpc.admin.refundInvoice.mutate({
        id
      })
  })
  return {
    ...rest
  }
}
