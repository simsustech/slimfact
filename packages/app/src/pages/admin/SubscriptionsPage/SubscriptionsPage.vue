<template>
  <q-page padding>
    <q-toolbar>
      <q-space />
      <q-toggle
        v-model="active"
        :label="lang.subscription.fields.active"
        left-label
      />
      <q-btn>
        <q-icon name="i-mdi-search" />
        <q-icon
          v-if="activeSearch"
          name="i-mdi-remove"
          size="xs"
          class="q-mr-none"
          @click="clearSearchResults"
        />
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
    <div class="flex flex-center q-mt-md">
      <q-pagination
        v-model="page"
        :disable="!(total && page && rowsPerPage)"
        :max="Math.ceil(total / rowsPerPage)"
        :max-pages="5"
        direction-links
      />
    </div>
  </q-page>

  <responsive-dialog
    ref="updateDialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
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
    ref="createDialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
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
import { ref, onMounted, computed, inject } from 'vue'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import SubscriptionForm from '../../../components/subscription/SubscriptionForm.vue'
import { useLang } from '../../../lang/index.js'

// import { useQuasar } from 'quasar'
import CompanySelect from '../../../components/company/CompanySelect.vue'
import ClientSelect from '../../../components/client/ClientSelect.vue'
import SubscriptionExpansionItem from '../../../components/subscription/SubscriptionExpansionItem.vue'

import { EventBus } from 'quasar'
import {
  useAdminCreateSubscriptionMutation,
  useAdminGetSubscriptionsQuery,
  useAdminStartSubscriptionMutation,
  useAdminStopSubscriptionMutation,
  useAdminUpdateSubscriptionMutation
} from 'src/queries/admin/subscriptions.js'
import { useAdminSearchClientsQuery } from 'src/queries/admin/clients.js'
import { useAdminSearchCompaniesQuery } from 'src/queries/admin/companies.js'
import { useAdminGetNumberPrefixesQuery } from 'src/queries/admin/numberPrefixes.js'
import { until } from '@vueuse/core'

const bus = inject<EventBus>('bus')!
bus.on('administrator-open-subscriptions-create-dialog', () => {
  if (openCreateDialog)
    openCreateDialog({
      done: () => {}
    })
})

// const $q = useQuasar()
const lang = useLang()

const {
  subscriptions,
  companyId,
  clientId,
  active,
  page,
  rowsPerPage,
  refetch: execute
} = useAdminGetSubscriptionsQuery()
const total = computed(() => subscriptions.value?.at(0)?.total || 0)

const { numberPrefixes, refetch: refetchNumberPrefixes } =
  useAdminGetNumberPrefixesQuery()
await refetchNumberPrefixes()

const updateSubscriptionFormRef = ref<typeof SubscriptionForm>()
const createSubscriptionFormRef = ref<typeof SubscriptionForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onUpdate'] = async ({ data }) => {
  updateDialogRef.value?.functions.open()

  await until(updateSubscriptionFormRef).toBeTruthy()

  updateSubscriptionFormRef.value?.functions.setValue(data)
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

const { mutateAsync: createSubscriptionMutation } =
  useAdminCreateSubscriptionMutation()
const { mutateAsync: updateSubscriptionMutation } =
  useAdminUpdateSubscriptionMutation()

const updateSubscription: InstanceType<
  typeof SubscriptionForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    delete data.client
    delete data.company
    await updateSubscriptionMutation(data)

    done()
    await execute()
  } catch (e) {}
}

const createSubscription: InstanceType<
  typeof SubscriptionForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    await createSubscriptionMutation(data)

    await execute()
    done()
  } catch (e) {}
}

const {
  companies: filteredCompanies,
  searchPhrase: companiesSearchPhrase,
  refetch: refetchFilteredCompanies
} = useAdminSearchCompaniesQuery()

// const filteredCompanies = ref<CompanyDetails[]>([])
const onFilterCompanies: InstanceType<
  typeof InvoiceForm
>['$props']['onFilter:companies'] = async ({ searchPhrase, done }) => {
  companiesSearchPhrase.value = searchPhrase
  await refetchFilteredCompanies()

  if (done) done()
}

const {
  clients: filteredClients,
  name: clientName,
  refetch: refetchFilteredClients
} = useAdminSearchClientsQuery()
// const filteredClients = ref<ClientDetails>([])
const onFilterClients: InstanceType<
  typeof InvoiceForm
>['$props']['onFilter:clients'] = async ({ searchPhrase, done }) => {
  clientName.value = searchPhrase
  await refetchFilteredClients()

  if (done) done()
}

const { mutateAsync: startSubscriptionMutation } =
  useAdminStartSubscriptionMutation()
const onStartSubscription: InstanceType<
  typeof SubscriptionExpansionItem
>['$props']['onStart'] = async ({ data, done }) => {
  try {
    if (data.id) {
      await startSubscriptionMutation({ id: data.id })
      done()
      await execute()
    }
  } catch (e) {}
}

const { mutateAsync: stopSubscriptionMutation } =
  useAdminStopSubscriptionMutation()
const onStopSubscription: InstanceType<
  typeof SubscriptionExpansionItem
>['$props']['onStart'] = async ({ data, done }) => {
  try {
    if (data.id) {
      await stopSubscriptionMutation({ id: data.id })
      done()
      await execute()
    }
  } catch (e) {}
}

const activeSearch = computed(
  () => !Number.isNaN(companyId.value) || !Number.isNaN(clientId.value)
)
const clearSearchResults = () => {
  companyId.value = NaN
  clientId.value = NaN
}

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  await refetchFilteredClients()
  await refetchFilteredCompanies()
  ready.value = true
})
</script>
