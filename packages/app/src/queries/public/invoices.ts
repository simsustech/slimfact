import { useMutation } from '@pinia/colada'
import { trpc } from '../../trpc.js'

export const usePublicPayWithIdealMutation = () => {
  const { ...rest } = useMutation({
    mutation: (uuid: string) =>
      trpc.public.payWithIdeal.mutate({
        uuid
      })
  })
  return {
    ...rest
  }
}

export const usePublicPayDownPaymentWithIdealMutation = () => {
  const { ...rest } = useMutation({
    mutation: (uuid: string) =>
      trpc.public.payDownPaymentWithIdeal.mutate({
        uuid
      })
  })
  return {
    ...rest
  }
}
