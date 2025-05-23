<template>
  <q-page padding>
    <q-toolbar>
      <q-space />
      <q-toggle
        v-model="active"
        :label="lang.subscription.fields.active"
        left-label
      />
      <q-btn icon="i-mdi-search">
        <q-menu class="q-pa-sm">
          <company-select
            v-model="companyId"
            :filtered-options="filteredCompanies"
            clearable
            @filter="onFilterCompanies"
          />
          <client-select
            v-model="clientId"
            :filtered-options="filteredClients"
            clearable
            @filter="onFilterClients"
          />
          <!-- <subscription-status-select v-model="status" /> -->
        </q-menu>
      </q-btn>
    </q-toolbar>
    <div v-if="ready" class="row">
      <q-list class="full-width" dense>
        <subscription-expansion-item
          v-for="subscription in subscriptions"
          :key="subscription.id"
          :model-value="subscription"
          @update="openUpdateDialog"
          @start="onStartSubscription"
          @stop="onStopSubscription"
        />
      </q-list>
    </div>
    <div class="row justify-center items-center">
      <q-pagination
        v-model="page"
        :max="Math.ceil(total / rowsPerPage)"
        :max-pages="5"
      />
    </div>
  </q-page>

  <responsive-dialog
    :icons="{ close: 'i-mdi-close' }"
    padding
    ref="updateDialogRef"
    persistent
    @submit="update"
  >
    <subscription-form
      ref="updateSubscriptionFormRef"
      :filtered-companies="filteredCompanies"
      :filtered-clients="filteredClients"
      :filtered-number-prefixes="numberPrefixes || []"
      @submit="updateSubscription"
      @filter:companies="onFilterCompanies"
      @filter:clients="onFilterClients"
    ></subscription-form>
  </responsive-dialog>
  <responsive-dialog
    :icons="{ close: 'i-mdi-close' }"
    padding
    ref="createDialogRef"
    persistent
    @submit="create"
  >
    <subscription-form
      ref="createSubscriptionFormRef"
      :filtered-companies="filteredCompanies"
      :filtered-clients="filteredClients"
      :filtered-number-prefixes="numberPrefixes || []"
      @submit="createSubscription"
      @filter:companies="onFilterCompanies"
      @filter:clients="onFilterClients"
    ></subscription-form>
  </responsive-dialog>
</template>

<script lang="ts">
export default {
  name: 'AdminSubscriptionsPage'
}
</script>

<script setup lang="ts">
import { ref, nextTick, onMounted, reactive, computed, inject } from 'vue'
import { createUseTrpc } from '../../../trpc.js'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import SubscriptionForm from '../../../components/subscription/SubscriptionForm.vue'
import { useLang } from '../../../lang/index.js'
import {
  type CompanyDetails,
  type ClientDetails
} from '@modular-api/fastify-checkout'
// import { useQuasar } from 'quasar'
import CompanySelect from '../../../components/company/CompanySelect.vue'
import ClientSelect from '../../../components/client/ClientSelect.vue'
import SubscriptionExpansionItem from '../../../components/subscription/SubscriptionExpansionItem.vue'

import { EventBus } from 'quasar'

const bus = inject<EventBus>('bus')!
bus.on('administrator-open-subscriptions-create-dialog', () => {
  if (openCreateDialog)
    openCreateDialog({
      done: () => {}
    })
})

const { useQuery, useMutation } = await createUseTrpc()

// const $q = useQuasar()
const lang = useLang()

const companyId = ref(NaN)
const clientId = ref(NaN)
const active = ref<boolean>()

const page = ref(1)
const rowsPerPage = ref(5)
const total = computed(() => subscriptions.value?.at(0)?.total || 0)
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

const { data: subscriptions, execute } = useQuery('admin.getSubscriptions', {
  args: reactive({
    companyId,
    clientId,
    active,
    pagination
  }),
  reactive: true
  // immediate: true
})

const { data: numberPrefixes } = useQuery('admin.getNumberPrefixes', {
  immediate: true
})

const updateSubscriptionFormRef = ref<typeof SubscriptionForm>()
const createSubscriptionFormRef = ref<typeof SubscriptionForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onUpdate'] = ({ data }) => {
  updateDialogRef.value?.functions.open()
  nextTick(() => {
    updateSubscriptionFormRef.value?.functions.setValue(data)
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
  updateSubscriptionFormRef.value?.functions.submit({ done: afterUpdate })
}

const create: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterCreate = (success?: boolean) => {
    done(success)
    if (success) execute()
  }
  createSubscriptionFormRef.value?.functions.submit({ done: afterCreate })
}

const updateSubscription: InstanceType<
  typeof SubscriptionForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  delete data.client
  delete data.company
  const result = useMutation('admin.updateSubscription', {
    args: data,
    immediate: true
  })

  await result.immediatePromise

  if (!result.error.value) await execute()

  done(!result.error.value)
}

const createSubscription: InstanceType<
  typeof SubscriptionForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.createSubscription', {
    args: data,
    immediate: true
  })

  await result.immediatePromise
  if (!result.error.value) {
    await execute()
  }
  done(!result.error.value)
}

const filteredCompanies = ref<CompanyDetails[]>([])
const onFilterCompanies: InstanceType<
  typeof SubscriptionForm
>['$props']['onFilter:companies'] = async ({ searchPhrase, done }) => {
  const result = useQuery('admin.searchCompanies', {
    args: searchPhrase,
    immediate: true
  })

  await result.immediatePromise

  if (result.data.value) filteredCompanies.value = result.data.value

  if (done) done()
}

const filteredClients = ref<ClientDetails>([])
const onFilterClients: InstanceType<
  typeof SubscriptionForm
>['$props']['onFilter:clients'] = async ({ searchPhrase, done }) => {
  const result = useQuery('admin.searchClients', {
    args: { name: searchPhrase },
    immediate: true
  })

  await result.immediatePromise

  if (result.data.value) filteredClients.value = result.data.value

  if (done) done()
}

const onStartSubscription: InstanceType<
  typeof SubscriptionExpansionItem
>['$props']['onStart'] = async ({ data, done }) => {
  if (data.id) {
    const result = useMutation('admin.startSubscription', {
      args: { id: data.id },
      immediate: true
    })

    await result.immediatePromise

    if (!result.error.value) await execute()
    if (done) done()
  }
}

const onStopSubscription: InstanceType<
  typeof SubscriptionExpansionItem
>['$props']['onStart'] = async ({ data, done }) => {
  if (data.id) {
    const result = useMutation('admin.stopSubscription', {
      args: { id: data.id },
      immediate: true
    })

    await result.immediatePromise

    if (!result.error.value) await execute()
    if (done) done()
  }
}

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
