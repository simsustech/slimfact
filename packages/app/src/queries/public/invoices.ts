import { useMutation } from '@pinia/colada'
import { trpc } from '../../trpc.js'

export const usePublicPayWithWeroMutation = () => {
  const { ...rest } = useMutation({
    mutation: (uuid: string) =>
      trpc.public.payWithWero.mutate({
        uuid
      })
  })
  return {
    ...rest
  }
}

export const usePublicPayWithCreditcardMutation = () => {
  const { ...rest } = useMutation({
    mutation: (uuid: string) =>
      trpc.public.payWithCreditcard.mutate({
        uuid
      })
  })
  return {
    ...rest
  }
}

export const usePublicPayDownPaymentWithWeroMutation = () => {
  const { ...rest } = useMutation({
    mutation: (uuid: string) =>
      trpc.public.payDownPaymentWithWero.mutate({
        uuid
      })
  })
  return {
    ...rest
  }
}
