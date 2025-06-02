<template>
  <q-page padding>
    <q-toolbar>
      <q-space />
      <q-btn icon="i-mdi-search">
        <q-menu class="q-pa-sm">
          <q-input v-model="name" :label="lang.name" :debounce="300" />
        </q-menu>
      </q-btn>
    </q-toolbar>
    <q-list v-if="ready">
      <client-item
        v-for="client in clients"
        :key="client.id"
        :model-value="client"
        show-update-button
        @update="openUpdateDialog"
    /></q-list>

    <div class="row justify-center items-center">
      <q-pagination
        v-model="page"
        :disable="!(total && page && rowsPerPage)"
        :max="Math.ceil(total / rowsPerPage)"
        :max-pages="5"
        direction-links
      />
    </div>
    <!-- <div class="row" v-if="ready">
      <client-card
        v-for="client in data"
        :key="client.id"
        :model-value="client"
        @update="openUpdateDialog"
      />
    </div> -->
  </q-page>

  <responsive-dialog
    :icons="{ close: 'i-mdi-close' }"
    padding
    ref="updateDialogRef"
    persistent
    @submit="update"
  >
    <client-form
      ref="updateClientFormRef"
      :filtered-accounts="filteredAccounts"
      @submit="updateClient"
      @filter:accounts="onFilterAccounts"
    ></client-form>
  </responsive-dialog>
  <responsive-dialog
    :icons="{ close: 'i-mdi-close' }"
    padding
    ref="createDialogRef"
    persistent
    @submit="create"
  >
    <client-form
      ref="createClientFormRef"
      :filtered-accounts="filteredAccounts"
      @submit="createClient"
      @filter:accounts="onFilterAccounts"
    ></client-form>
  </responsive-dialog>
</template>

<script lang="ts">
export default {
  name: 'AdminClientsPage'
}
</script>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed, inject } from 'vue'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import ClientForm from '../../../components/client/ClientForm.vue'
import ClientItem from '../../../components/client/ClientItem.vue'
import { useLang } from '../../../lang/index.js'
import AccountSelect from '../../../components/admin/AccountSelect.vue'

import { EventBus } from 'quasar'
import {
  useAdminCreateClientMutation,
  useAdminSearchClientsQuery,
  useAdminUpdateClientMutation
} from 'src/queries/admin/clients.js'
import { useAdminSearchAccountsQuery } from 'src/queries/admin/accounts.js'

const bus = inject<EventBus>('bus')!
bus.on('administrator-open-clients-create-dialog', () => {
  if (openCreateDialog)
    openCreateDialog({
      done: () => {}
    })
})

const lang = useLang()

const {
  clients,
  refetch: execute,
  name,
  page,
  rowsPerPage
} = useAdminSearchClientsQuery()
const total = computed(() => clients.value?.at(0)?.total || 0)

// const { data, execute } = useQuery('admin.searchClients', {
//   args: reactive({
//     name,
//     pagination
//   })
//   // immediate: true
// })

const updateClientFormRef = ref<typeof ClientForm>()
const createClientFormRef = ref<typeof ClientForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onUpdate'] = ({ data }) => {
  updateDialogRef.value?.functions.open()
  nextTick(() => {
    updateClientFormRef.value?.functions.setValue(data)
  })
}

const openCreateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onCreate'] = () => {
  createDialogRef.value?.functions.open()
}

const update: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterUpdate = (success?: boolean) => {
    done(success)
    execute()
  }
  updateClientFormRef.value?.functions.submit({ done: afterUpdate })
}

const create: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterCreate = (success?: boolean) => {
    done(success)
    execute()
  }
  createClientFormRef.value?.functions.submit({ done: afterCreate })
}

const { mutateAsync: createClientMutation } = useAdminCreateClientMutation()
const { mutateAsync: updateClientMutation } = useAdminUpdateClientMutation()

const updateClient: InstanceType<
  typeof ClientForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    await updateClientMutation(data)
    done()
  } catch (e) {}
}

const createClient: InstanceType<
  typeof ClientForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    await createClientMutation(data)
    done()
  } catch (e) {}
}

const {
  accounts: filteredAccounts,
  email,
  ids: accountIds,
  refetch: refetchAccounts
} = useAdminSearchAccountsQuery()

const onFilterAccounts: InstanceType<
  typeof AccountSelect
>['$props']['onFilter'] = async ({ ids, searchPhrase, done }) => {
  try {
    email.value = searchPhrase
    accountIds.value = ids
    await refetchAccounts()

    done()
  } catch (e) {}
}

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
