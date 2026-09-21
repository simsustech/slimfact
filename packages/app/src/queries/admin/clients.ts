import { defineQuery, useMutation, useQuery } from '@pinia/colada'
import { trpc } from '../../trpc.js'
import { ref, computed } from 'vue'
import { Client } from '@slimfact/api/zod'

export const useAdminSearchClientsQuery = defineQuery(() => {
  const name = ref<string | null>(null)
  const page = ref(1)
  const rowsPerPage = ref(5)
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
  // Lazy: off (and out of the page-mount batch) until a client select asks for
  // data via `activate()` — see companies.ts.
  const active = ref(false)

  const { data: clients, ...rest } = useQuery({
    enabled: () => !import.meta.env.SSR && active.value,
    key: () => ['adminSearchClients', name.value, pagination.value],
    query: () =>
      trpc.admin.searchClients.query({
        name: name.value,
        pagination: pagination.value
      }),
    placeholderData: () => []
  })

  const activate = () => {
    active.value = true
    return rest.refetch()
  }

  return {
    clients,
    name,
    page,
    rowsPerPage,
    activate,
    ...rest
  }
})

export const useAdminCreateClientMutation = () => {
  const { ...rest } = useMutation({
    mutation: (client: Client) => trpc.admin.createClient.mutate(client)
  })
  return {
    ...rest
  }
}

export const useAdminUpdateClientMutation = () => {
  const { ...rest } = useMutation({
    mutation: (client: Client) => trpc.admin.updateClient.mutate(client)
  })
  return {
    ...rest
  }
}
