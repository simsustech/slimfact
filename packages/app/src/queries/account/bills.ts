import { defineQuery, useQuery } from '@pinia/colada'
import { trpc } from 'src/trpc'

export const useAccountGetBillsQuery = defineQuery(() => {
  const { data: bills, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => ['accountGetBills'],
    query: () => trpc.user.getBills.query()
  })

  return {
    bills,
    ...rest
  }
})
