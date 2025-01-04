<template>
  <resource-page>
    <template #header>
      {{ lang.receipt.title }}
    </template>
    <template #header-side>
      <q-btn icon="search">
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
    </template>
    <div v-if="ready" class="row">
      <q-list class="full-width" dense>
        <invoice-expansion-item
          v-for="invoice in invoices"
          :key="invoice.id"
          :model-value="invoice"
          @send:invoice="($event) => openSendInvoiceDialog()!($event)"
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
  </resource-page>

  <responsive-dialog
    ref="sendInvoiceDialogRef"
    persistent
    @submit="sendInvoice"
  >
    <email-input
      v-model:subject="sendInvoiceEmailSubject"
      v-model:body="sendInvoiceEmailBody"
    />
  </responsive-dialog>
</template>

<script lang="ts">
export default {
  name: 'AdminInvoicesPage'
}
</script>

<script setup lang="ts">
import { ref, onMounted, reactive, computed, watch } from 'vue'
import { createUseTrpc } from '../../trpc.js'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import { EmailInput } from '@simsustech/quasar-components/form'
import InvoiceForm from '../../components/invoice/InvoiceForm.vue'
import InvoiceExpansionItem from '../../components/invoice/InvoiceExpansionItem.vue'
import { useLang } from '../../lang/index.js'
import {
  type CompanyDetails,
  type ClientDetails
} from '@modular-api/fastify-checkout'
import CompanySelect from '../../components/company/CompanySelect.vue'
import ClientSelect from '../../components/client/ClientSelect.vue'
import { InvoiceStatus } from '@slimfact/api/zod'
import { QSelect } from 'quasar'
import { onBeforeRouteUpdate, useRoute } from 'vue-router'

const { useQuery, useMutation } = await createUseTrpc()

const lang = useLang()

const route = useRoute()

const uuids = ref<string[]>((route.params.uuids as string[]) || undefined)
onBeforeRouteUpdate((to) => {
  if (to.params.uuids && Array.isArray(to.params.ids)) {
    uuids.value = to.params.uuids as string[]
  } else {
    uuids.value = undefined
  }
})

const companyId = ref(NaN)
const clientId = ref(NaN)
const clientDetails = ref({
  name: null as string | null
})
const status = ref<InvoiceStatus>(InvoiceStatus.RECEIPT)

const page = ref(1)
const rowsPerPage = ref(5)
const total = computed(() => invoices.value?.at(0)?.total || 0)
const pagination = computed<{
  limit: number
  offset: number
  sortBy: 'id' | 'companyId' | 'clientId' | 'totalIncludingTax'
  descending: boolean
}>(() => ({
  limit: rowsPerPage.value,
  offset: (page.value - 1) * rowsPerPage.value,
  sortBy: 'id',
  descending: true
}))

const { data: invoices, execute } = useQuery('admin.getInvoices', {
  args: reactive({
    companyId,
    clientId,
    clientDetails,
    status,
    pagination,
    uuids
  })
  // immediate: true
})

const filteredCompanies = ref<CompanyDetails[]>([])
const onFilterCompanies: InstanceType<
  typeof InvoiceForm
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
  typeof InvoiceForm
>['$props']['onFilter:clients'] = async ({ searchPhrase, done }) => {
  const result = useQuery('admin.searchClients', {
    args: { name: searchPhrase },
    immediate: true
  })

  await result.immediatePromise

  if (result.data.value) filteredClients.value = result.data.value

  if (done) done()
}

const openSendInvoiceDialog = (): InstanceType<
  typeof InvoiceExpansionItem
>['$props']['onSend'] => {
  return async ({ data, done }) => {
    const result = useQuery('admin.getInvoiceEmail', {
      args: {
        id: data.id,
        type: 'invoice',
        action: 'send'
      },
      immediate: true
    })

    await result.immediatePromise

    if (
      sendInvoiceDialogRef?.value &&
      result.data.value?.subject &&
      result.data.value?.body
    ) {
      sendInvoiceEmailType.value = 'sendInvoice'
      sendInvoiceEmailId.value = data.id
      sendInvoiceEmailSubject.value = result.data.value.subject
      sendInvoiceEmailBody.value = result.data.value.body
      sendInvoiceDialogRef.value.functions.open()
    }

    done(!result.error.value)
  }
}

const sendInvoiceEmailType = ref<'sendInvoice'>('sendInvoice')
const sendInvoiceEmailId = ref(NaN)
const sendInvoiceEmailSubject = ref('')
const sendInvoiceEmailBody = ref('')

const sendInvoiceDialogRef = ref<typeof ResponsiveDialog>()

const sendMutations = {
  sendInvoice: 'admin.sendInvoice'
} as const

const sendInvoice: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const result = useMutation(sendMutations[sendInvoiceEmailType.value], {
    args: {
      id: sendInvoiceEmailId.value,
      emailSubject: sendInvoiceEmailSubject.value,
      emailBody: sendInvoiceEmailBody.value
    },
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
  if (!result.error.value) {
    sendInvoiceEmailType.value = 'sendInvoice'
    sendInvoiceEmailId.value = NaN
    sendInvoiceEmailSubject.value = ''
    sendInvoiceEmailBody.value = ''
    execute()
  }
}

const onNewValueClients: QSelect['$props']['onNewValue'] = (input) => {
  clientId.value = NaN
  clientDetails.value.name = input
}

watch(clientId, (newVal) => {
  if (newVal) clientDetails.value.name = null
})

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
