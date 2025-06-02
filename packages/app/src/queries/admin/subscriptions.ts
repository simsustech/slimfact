import { defineQuery, useMutation, useQuery } from '@pinia/colada'
import { ref, computed } from 'vue'
import { trpc } from '../../trpc.js'
import { Subscription } from '@slimfact/api/zod'

export const useAdminGetSubscriptionsQuery = defineQuery(() => {
  const companyId = ref(NaN)
  const clientId = ref(NaN)
  const page = ref(1)
  const rowsPerPage = ref(5)
  const active = ref<boolean>()
  const pagination = computed<{
    limit: number
    offset: number
    sortBy: 'id'
    descending: boolean
  }>(() => ({
    limit: rowsPerPage.value,
    offset: (page.value - 1) * rowsPerPage.value,
    sortBy: 'id',
    descending: true
  }))

  const { data: subscriptions, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => [
      'adminGetSubscriptions',
      clientId.value,
      companyId.value,
      { active: active.value },
      pagination.value
    ],
    query: () =>
      trpc.admin.getSubscriptions.query({
        companyId: companyId.value,
        clientId: clientId.value,
        pagination: pagination.value,
        active: active.value
      })
  })
  return {
    subscriptions,
    companyId,
    clientId,
    page,
    rowsPerPage,
    active,
    ...rest
  }
})

export const useAdminCreateSubscriptionMutation = () => {
  const { ...rest } = useMutation({
    mutation: (subscription: Subscription) =>
      trpc.admin.createSubscription.mutate(subscription)
  })
  return {
    ...rest
  }
}

export const useAdminUpdateSubscriptionMutation = () => {
  const { ...rest } = useMutation({
    mutation: (subscription: Subscription) =>
      trpc.admin.updateSubscription.mutate(subscription)
  })
  return {
    ...rest
  }
}

export const useAdminStartSubscriptionMutation = () => {
  const { ...rest } = useMutation({
    mutation: ({ id }: { id: number }) =>
      trpc.admin.startSubscription.mutate({ id })
  })
  return {
    ...rest
  }
}

export const useAdminStopSubscriptionMutation = () => {
  const { ...rest } = useMutation({
    mutation: ({ id }: { id: number }) =>
      trpc.admin.stopSubscription.mutate({ id })
  })
  return {
    ...rest
  }
}
