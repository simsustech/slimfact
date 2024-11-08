<template>
  <resource-page
    type="create"
    @create="openCreateDialog"
    @update="openUpdateDialog"
  >
    <template #header>
      {{ lang.client.title }}
    </template>
    <template #header-side>
      <q-btn icon="search">
        <q-menu class="q-pa-sm">
          <q-input v-model="name" :label="lang.name" :debounce="300" />
        </q-menu>
      </q-btn>
    </template>
    <q-list v-if="ready">
      <client-item
        v-for="client in data"
        :key="client.id"
        :model-value="client"
        show-update-button
        @update="openUpdateDialog"
    /></q-list>

    <div class="row justify-center items-center">
      <q-pagination
        v-model="page"
        :max="Math.ceil(total / rowsPerPage)"
        :max-pages="5"
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

    <responsive-dialog ref="updateDialogRef" persistent @submit="update">
      <client-form
        ref="updateClientFormRef"
        :filtered-accounts="filteredAccounts"
        @submit="updateClient"
        @filter:accounts="onFilterAccounts"
      ></client-form>
    </responsive-dialog>
    <responsive-dialog ref="createDialogRef" persistent @submit="create">
      <client-form
        ref="createClientFormRef"
        :filtered-accounts="filteredAccounts"
        @submit="createClient"
        @filter:accounts="onFilterAccounts"
      ></client-form>
    </responsive-dialog>
  </resource-page>
</template>

<script lang="ts">
export default {
  name: 'AdminClientsPage'
}
</script>

<script setup lang="ts">
import { ref, nextTick, onMounted, reactive, computed } from 'vue'
import { createUseTrpc } from '../../trpc.js'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import ClientForm from '../../components/client/ClientForm.vue'
import ClientItem from '../../components/client/ClientItem.vue'
import { useLang } from '../../lang/index.js'
import { Account } from '@slimfact/api/zod'
import AccountSelect from '../../components/admin/AccountSelect.vue'
const { useQuery, useMutation } = await createUseTrpc()

const lang = useLang()

const name = ref<string>('')

const page = ref(1)
const rowsPerPage = ref(5)
const total = computed(() => data.value?.at(0)?.total || 0)
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

const { data, execute } = useQuery('admin.searchClients', {
  args: reactive({
    name,
    pagination
  })
  // immediate: true
})

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

const updateClient: InstanceType<
  typeof ClientForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.updateClient', {
    args: data,
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}

const createClient: InstanceType<
  typeof ClientForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.createClient', {
    args: data,
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}

const filteredAccounts = ref<Account[]>([])

const onFilterAccounts: InstanceType<
  typeof AccountSelect
>['$props']['onFilter'] = async ({ ids, searchPhrase, done }) => {
  const result = useQuery('admin.findAccounts', {
    args: { email: searchPhrase, ids },
    immediate: true
  })

  await result.immediatePromise

  if (result.data.value) filteredAccounts.value = result.data.value

  if (done) done()
}

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
