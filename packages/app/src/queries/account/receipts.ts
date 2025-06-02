import { defineQuery, useQuery } from '@pinia/colada'
import { trpc } from 'src/trpc'

export const useAccountGetReceiptsQuery = defineQuery(() => {
  const { data: receipts, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => ['accountGetReceipts'],
    query: () => trpc.user.getReceipts.query()
  })

  return {
    receipts,
    ...rest
  }
})
