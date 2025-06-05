import { defineQuery, useMutation, useQuery } from '@pinia/colada'
import { trpc } from '../../trpc.js'
import { ref } from 'vue'
import { SLIMFACT_ACCOUNT_ROLES } from '@slimfact/api/zod'

export const useAdminGetAccountsQuery = defineQuery(() => {
  const pagination = ref({
    limit: 5,
    offset: 0,
    sortBy: 'id' as 'id' | 'email' | 'name',
    descending: false
  })

  const criteria = ref({
    name: '',
    email: '',
    roles: []
  })

  const { data: accounts, ...rest } = useQuery({
    enabled: () => !import.meta.env.SSR,
    key: () => [
      'adminGetAccounts',
      criteria.value.name,
      criteria.value.email,
      criteria.value.roles,
      { pagination: pagination.value }
    ],
    query: () =>
      trpc.admin.getAccounts.query({
        criteria: criteria.value,
        pagination: pagination.value
      }),
    initialData: () => []
  })

  return {
    accounts,
    pagination,
    criteria,
    ...rest
  }
})

export const useAdminSearchAccountsQuery = defineQuery(() => {
  const email = ref('')
  const ids = ref<number[]>([])

  const { data: accounts, ...rest } = useQuery({
    enabled: () => !import.meta.env.SSR && (!!email.value || !!ids.value),
    key: () => ['adminSearchAccounts', email.value, ids.value],
    query: () =>
      trpc.admin.findAccounts.query({
        email: email.value,
        ids: ids.value
      }),
    initialData: () => []
  })

  return {
    accounts,
    email,
    ids,
    ...rest
  }
})

export const useAdminAddRoleMutation = () => {
  const { ...rest } = useMutation({
    mutation: ({ id, role }: { id: number; role: SLIMFACT_ACCOUNT_ROLES }) =>
      trpc.admin.addRole.mutate({ id, role })
  })
  return {
    ...rest
  }
}

export const useAdminRemoveRoleMutation = () => {
  const { ...rest } = useMutation({
    mutation: ({ id, role }: { id: number; role: SLIMFACT_ACCOUNT_ROLES }) =>
      trpc.admin.removeRole.mutate({ id, role })
  })
  return {
    ...rest
  }
}
