import { useMutation } from '@pinia/colada'
import { trpc } from '../../trpc.js'

export const useAccountInvoiceEventEmailOpenedMutation = () => {
  const { ...rest } = useMutation({
    mutation: ({ invoiceId }: { invoiceId: number }) =>
      trpc.user.emailOpened.mutate({ invoiceId })
  })
  return {
    ...rest
  }
}
