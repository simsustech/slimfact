import { defineQuery, useMutation, useQuery } from '@pinia/colada'
import { trpc } from '../../trpc.js'
import { ref } from 'vue'

export const useAdminGetInvoiceEmailQuery = defineQuery(() => {
  const id = ref<number>(NaN)
  const type = ref<'invoice' | 'bill' | 'receipt'>('invoice')
  const action = ref<'exhort' | 'remind' | 'send'>('send')

  const { data: email, ...rest } = useQuery({
    enabled: () => !import.meta.env.SSR && !Number.isNaN(id.value),
    key: () => ['adminGetInvoiceEmail', id.value, type.value, action.value],
    query: () =>
      trpc.admin.getInvoiceEmail.query({
        id: id.value,
        type: type.value,
        action: action.value
      })
  })

  return {
    email,
    id,
    type,
    action,
    ...rest
  }
})

export const useAdminSendBillMutation = () => {
  const { ...rest } = useMutation({
    mutation: ({
      id,
      emailSubject,
      emailBody
    }: {
      id: number
      emailSubject: string
      emailBody: string
    }) =>
      trpc.admin.sendBill.mutate({
        id,
        emailSubject,
        emailBody
      })
  })
  return {
    ...rest
  }
}

export const useAdminSendReceiptMutation = () => {
  const { mutate: sendReceipt, ...rest } = useMutation({
    mutation: ({
      id,
      emailSubject,
      emailBody
    }: {
      id: number
      emailSubject: string
      emailBody: string
    }) =>
      trpc.admin.sendReceipt.mutate({
        id,
        emailSubject,
        emailBody
      })
  })
  return {
    sendReceipt,
    ...rest
  }
}

export const useAdminSendInvoiceMutation = () => {
  const { mutate: sendInvoice, ...rest } = useMutation({
    mutation: ({
      id,
      emailSubject,
      emailBody
    }: {
      id: number
      emailSubject: string
      emailBody: string
    }) =>
      trpc.admin.sendInvoice.mutate({
        id,
        emailSubject,
        emailBody
      })
  })
  return {
    sendInvoice,
    ...rest
  }
}

export const useAdminRemindInvoiceMutation = () => {
  const { mutate: remindInvoice, ...rest } = useMutation({
    mutation: ({
      id,
      emailSubject,
      emailBody
    }: {
      id: number
      emailSubject: string
      emailBody: string
    }) =>
      trpc.admin.remindInvoice.mutate({
        id,
        emailSubject,
        emailBody
      })
  })
  return {
    remindInvoice,
    ...rest
  }
}

export const useAdminExhortInvoiceMutation = () => {
  const { mutate: exhortInvoice, ...rest } = useMutation({
    mutation: ({
      id,
      emailSubject,
      emailBody
    }: {
      id: number
      emailSubject: string
      emailBody: string
    }) =>
      trpc.admin.exhortInvoice.mutate({
        id,
        emailSubject,
        emailBody
      })
  })
  return {
    exhortInvoice,
    ...rest
  }
}
