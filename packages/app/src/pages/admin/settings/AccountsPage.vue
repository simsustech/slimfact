<template>
  <q-page padding>
    <accounts-table
      v-if="accounts"
      v-model:pagination="pagination"
      v-model:criteria="criteria"
      :model-value="accounts"
      :mapped-roles="mappedRoles"
      :count="count"
      :icons="{
        search: 'i-mdi-search',
        cancel: 'i-mdi-close-circle',
        moreVert: 'i-mdi-more-vert'
      }"
      @add-role="onAddRole"
      @remove-role="onRemoveRole"
    />
  </q-page>
</template>

<script lang="ts">
export default {
  name: 'AdminAccountsPage'
}
</script>

<script setup lang="ts">
import { AccountsTable } from '@simsustech/quasar-components/authentication'
import { computed, onMounted } from 'vue'
import { useLang } from '../../../lang/index.js'
import { SLIMFACT_ACCOUNT_ROLES } from '@slimfact/api/zod'
import {
  useAdminAddRoleMutation,
  useAdminGetAccountsQuery,
  useAdminRemoveRoleMutation
} from 'src/queries/admin/accounts.js'
import { useQuery } from '@pinia/colada'
import { trpc } from 'src/trpc.js'

const lang = useLang()

const { accounts, criteria, pagination, refetch } = useAdminGetAccountsQuery()

// const pagination = ref({
//   limit: 5,
//   offset: 0,
//   sortBy: 'id' as 'id' | 'email' | 'name',
//   descending: false
// })

// const criteria = ref({
//   name: '',
//   email: '',
//   roles: []
// })

// const { data: accounts, execute: executeAccounts } = useQuery(
//   'admin.getAccounts',
//   {
//     args: reactive({ pagination, criteria }),
//     immediate: true,
//     reactive: true
//   }
// )

const { data: count, refetch: refetchCount } = useQuery({
  enabled: !import.meta.env.SSR,
  key: () => ['adminGetAccountsCount', { criteria: criteria.value }],
  query: () => trpc.admin.getAccountsCount.query({ criteria: criteria.value }),
  initialData: () => 0
})

const { mutateAsync: addRoleMutaton } = useAdminAddRoleMutation()
const { mutateAsync: removeRoleMutation } = useAdminRemoveRoleMutation()

const mappedRoles = computed(() =>
  Object.values(SLIMFACT_ACCOUNT_ROLES).reduce(
    (acc, cur) => {
      acc[cur] = lang.value.account.roles[cur]
      return acc
    },
    {} as Record<SLIMFACT_ACCOUNT_ROLES, string>
  )
)

const onAddRole = async ({ id, role }: { id: number; role: string }) => {
  try {
    await addRoleMutaton({ id, role: role as SLIMFACT_ACCOUNT_ROLES })

    await refetch()
  } catch (e) {}
}

const onRemoveRole = async ({ id, role }: { id: number; role: string }) => {
  try {
    await removeRoleMutation({ id, role: role as SLIMFACT_ACCOUNT_ROLES })
    await refetch()
  } catch (e) {}
}

onMounted(async () => {
  await refetch()
  await refetchCount()
})
</script>
