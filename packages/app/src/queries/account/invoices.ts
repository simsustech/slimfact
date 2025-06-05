import { defineQuery, useQuery } from '@pinia/colada'
import { trpc } from 'src/trpc'

export const useAccountGetInvoicesQuery = defineQuery(() => {
  const { data: invoices, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => ['accountGetInvoices'],
    query: () => trpc.user.getInvoices.query()
  })

  return {
    invoices,
    ...rest
  }
})
