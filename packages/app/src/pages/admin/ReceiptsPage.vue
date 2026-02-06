<template>
  <q-page padding>
    <q-toolbar>
      <q-space />
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
            use-input
            @filter="onFilterClients"
            @new-value="onNewValueClients"
          />
          <!-- <invoice-status-select v-model="status" /> -->
        </q-menu>
      </q-btn>
    </q-toolbar>
    <div v-if="ready" class="row">
      <q-list class="full-width" dense>
        <invoice-expansion-item
          v-for="receipt in receipts"
          :key="receipt.id"
          :model-value="receipt"
          v-on="invoiceExpansionItemHandlers"
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
    ref="sendEmailDialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
    persistent
    @submit="sendReceipt"
  >
    <email-input
      v-model:subject="sendEmailSubject"
      v-model:body="sendEmailBody"
    />
  </responsive-dialog>
</template>

<script lang="ts">
export default {
  name: 'AdminInvoicesPage'
}
</script>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ResponsiveDialog } from '@simsustech/quasar-components'
import { EmailInput } from '@simsustech/quasar-components/form'
import InvoiceForm from '../../components/invoice/InvoiceForm.vue'
import InvoiceExpansionItem from '../../components/invoice/InvoiceExpansionItem.vue'

import CompanySelect from '../../components/company/CompanySelect.vue'
import ClientSelect from '../../components/client/ClientSelect.vue'
import { QSelect } from 'quasar'
import { onBeforeRouteUpdate, useRoute } from 'vue-router'

import { useAdminGetReceiptsQuery } from '../../queries/admin/receipts.js'
import { useAdminSearchCompaniesQuery } from 'src/queries/admin/companies.js'
import { useAdminSearchClientsQuery } from 'src/queries/admin/clients.js'
import {
  useAdminGetInvoiceEmailQuery,
  useAdminSendInvoiceMutation,
  useAdminSendReceiptMutation
} from 'src/queries/admin/email.js'

const route = useRoute()

onBeforeRouteUpdate((to) => {
  if (to.params.uuids && Array.isArray(to.params.uuids)) {
    uuids.value = to.params.uuids as string[]
  } else {
    uuids.value = undefined
  }
})

const {
  receipts,
  companyId,
  clientId,
  clientDetails,
  page,
  rowsPerPage,
  uuids,
  refetch: execute
} = useAdminGetReceiptsQuery()

if (route.params.uuids && Array.isArray(route.params.uuids)) {
  uuids.value = route.params.uuids as string[]
}

const total = computed(() => receipts.value?.at(0)?.total || 0)

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

const openSendEmailDialog = (
  type: 'receipt' | 'invoice'
): InstanceType<typeof InvoiceExpansionItem>['$props']['onSend'] => {
  return async ({ data, done }) => {
    sendEmailId.value = data.id
    sendEmailType.value = type
    sendEmailAction.value = 'send'

    await refetchEmail()

    if (email.value && sendEmailDialogRef?.value) {
      sendEmailBody.value = email.value.body
      sendEmailSubject.value = email.value?.subject

      sendEmailDialogRef.value.functions.open()

      done()
    }
  }
}

const {
  email,
  id: sendEmailId,
  type: sendEmailType,
  action: sendEmailAction,
  refetch: refetchEmail
} = useAdminGetInvoiceEmailQuery()
const sendEmailSubject = ref('')
const sendEmailBody = ref('')

const sendEmailDialogRef = ref<typeof ResponsiveDialog>()

const { mutateAsync: sendReceiptMutation } = useAdminSendReceiptMutation()
const { mutateAsync: sendInvoiceMutation } = useAdminSendInvoiceMutation()

const sendMutations = {
  bill: () => {},
  receipt: sendReceiptMutation,
  invoice: sendInvoiceMutation
} as const

const sendReceipt: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  try {
    await sendMutations[sendEmailType.value]({
      id: sendEmailId.value,
      emailSubject: sendEmailSubject.value,
      emailBody: sendEmailBody.value
    })

    done()
    // sendBillEmailType.value = 'sendBill'
    sendEmailId.value = NaN
    sendEmailSubject.value = ''
    sendEmailBody.value = ''
    execute()
  } catch (e) {}
}

const onNewValueClients: QSelect['$props']['onNewValue'] = (input) => {
  clientId.value = NaN
  clientDetails.value.name = input
}

watch(clientId, (newVal) => {
  if (newVal) clientDetails.value.name = null
})

const invoiceExpansionItemHandlers = computed(() => ({
  // send: openSendEmailDialog('receipt'),
  sendInvoice: openSendEmailDialog('invoice')
}))

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
