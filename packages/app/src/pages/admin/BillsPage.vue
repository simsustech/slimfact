<template>
  <resource-page
    style="min-height: inherit"
    type="create"
    @create="openCreateDialog"
    @update="openUpdateDialog"
  >
    <template #header>
      {{ lang.bill.title }}
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
          <boolean-select v-model="paid" :label="lang.invoice.status.paid" />
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
          @send="($event) => openSendBillDialog('bill')!($event)"
          @update="openUpdateDialog"
          @send-receipt="($event) => openSendBillDialog('receipt')!($event)"
          @add-payment-cash="openAddCashPaymentDialog"
          @add-payment-pin="openAddPinPaymentDialog"
          @cancel="openCancelDialog"
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

    <responsive-dialog ref="updateDialogRef" persistent @submit="update">
      <invoice-form
        ref="updateInvoiceFormRef"
        :filtered-companies="filteredCompanies"
        :filtered-clients="filteredClients"
        :filtered-number-prefixes="numberPrefixes || []"
        @submit="updateInvoice"
        @filter:companies="onFilterCompanies"
        @filter:clients="onFilterClients"
      ></invoice-form>
    </responsive-dialog>
    <responsive-dialog ref="createDialogRef" persistent @submit="create">
      <invoice-form
        ref="createInvoiceFormRef"
        :filtered-companies="filteredCompanies"
        :filtered-clients="filteredClients"
        :filtered-number-prefixes="numberPrefixes || []"
        @submit="createInvoice"
        @filter:companies="onFilterCompanies"
        @filter:clients="onFilterClients"
      ></invoice-form>
    </responsive-dialog>
    <responsive-dialog
      ref="sendBillDialogRef"
      button-type="send"
      persistent
      @submit="sendBill"
    >
      <email-input
        v-model:subject="sendBillEmailSubject"
        v-model:body="sendBillEmailBody"
      />
    </responsive-dialog>
  </resource-page>
</template>

<script lang="ts">
export default {
  name: 'AdminInvoicesPage'
}
</script>

<script setup lang="ts">
import { ref, nextTick, onMounted, reactive, computed, watch } from 'vue'
import { createUseTrpc } from '../../trpc.js'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import { EmailInput, BooleanSelect } from '@simsustech/quasar-components/form'
import InvoiceForm from '../../components/invoice/InvoiceForm.vue'
import InvoiceExpansionItem from '../../components/invoice/InvoiceExpansionItem.vue'
import { useLang } from '../../lang/index.js'
import {
  type CompanyDetails,
  type ClientDetails
} from '@modular-api/fastify-checkout'
import { PaymentMethod } from '@modular-api/fastify-checkout/types'
import { InvoiceStatus } from '@slimfact/api/zod'

import { useQuasar, QSelect } from 'quasar'
import CompanySelect from '../../components/company/CompanySelect.vue'
import ClientSelect from '../../components/client/ClientSelect.vue'
import PriceInputDialog from '../../components/PriceInputDialog.vue'
import AddPaymentDialog from '../../components/AddPaymentDialog.vue'
import { onBeforeRouteUpdate, useRoute } from 'vue-router'

const { useQuery, useMutation } = await createUseTrpc()

const $q = useQuasar()
const lang = useLang()

const route = useRoute()

const uuids = ref((route.params.uuids as string[]) || [])
onBeforeRouteUpdate((to) => {
  if (to.params.uuids && Array.isArray(to.params.ids)) {
    uuids.value = to.params.uuids
  }
})

const companyId = ref(NaN)
const clientId = ref(NaN)
const status = ref<InvoiceStatus | null>(InvoiceStatus.BILL)
const clientDetails = ref({
  name: null as string | null
})
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
const paid = ref()

const { data: invoices, execute } = useQuery('admin.getInvoices', {
  args: reactive({
    companyId,
    clientId,
    clientDetails,
    status,
    pagination,
    paid,
    uuids
  })
  // immediate: true
})

const { data: numberPrefixes } = useQuery('admin.getNumberPrefixes', {
  immediate: true
})

const updateInvoiceFormRef = ref<typeof InvoiceForm>()
const createInvoiceFormRef = ref<typeof InvoiceForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onUpdate'] = ({ data }) => {
  updateDialogRef.value?.functions.open()
  nextTick(() => {
    updateInvoiceFormRef.value?.functions.setValue(data)
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
  updateInvoiceFormRef.value?.functions.submit({ done: afterUpdate })
}

const create: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterCreate = (success?: boolean) => {
    done(success)
    if (success) execute()
  }
  createInvoiceFormRef.value?.functions.submit({ done: afterCreate })
}

const updateInvoice: InstanceType<
  typeof InvoiceForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.updateInvoice', {
    args: data,
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}

const createInvoice: InstanceType<
  typeof InvoiceForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.createInvoice', {
    args: { ...data, status: InvoiceStatus.BILL },
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}

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

const openAddCashPaymentDialog: InstanceType<
  typeof InvoiceExpansionItem
>['$props']['onMarkPaid'] = async ({ data, done }) => {
  const format = (value: number) =>
    Intl.NumberFormat(data.locale, {
      maximumFractionDigits: 2,
      style: 'currency',
      currency: data.currency
    }).format(value / 100)
  return $q
    .dialog({
      component: PriceInputDialog,
      componentProps: {
        message: lang.value.invoice.messages.addCashPayment({
          clientDetails: data.clientDetails,
          totalIncludingTax: format(data.totalIncludingTax)
        }),
        currency: data.currency
      }
    })
    .onOk(async (amount) => {
      const result = useMutation('admin.addPaymentToInvoice', {
        args: {
          id: data.id,
          payment: {
            amount,
            currency: data.currency,
            description: new Date().toISOString().slice(0, 10),
            method: PaymentMethod.cash
          }
        },
        immediate: true
      })

      await result.immediatePromise

      if (!result.error.value) execute()
    })
}

const openAddPinPaymentDialog: InstanceType<
  typeof InvoiceExpansionItem
>['$props']['onMarkPaid'] = async ({ data, done }) => {
  const format = (value: number) =>
    Intl.NumberFormat($q.lang.isoName, {
      maximumFractionDigits: 2,
      style: 'currency',
      currency: data.currency
    }).format(value / 100)
  return $q
    .dialog({
      component: AddPaymentDialog,
      componentProps: {
        message: lang.value.invoice.messages.addPinPayment({
          clientDetails: data.clientDetails,
          totalIncludingTax: format(data.totalIncludingTax)
        }),
        currency: data.currency
      }
    })
    .onOk(async ({ amount, transactionReference }) => {
      const result = useMutation('admin.addPaymentToInvoice', {
        args: {
          id: data.id,
          payment: {
            amount,
            currency: data.currency,
            description: new Date().toISOString().slice(0, 10),
            transactionReference,
            method: PaymentMethod.pin
          }
        },
        immediate: true
      })
      await result.immediatePromise

      if (!result.error.value) {
        await execute()
      }
    })
}

const openCancelDialog: InstanceType<
  typeof InvoiceExpansionItem
>['$props']['onCancel'] = async ({ data, done }) => {
  const format = (value: number) =>
    Intl.NumberFormat(data.locale, {
      maximumFractionDigits: 2,
      style: 'currency',
      currency: data.currency
    }).format(value / 100)
  return $q
    .dialog({
      cancel: true,
      message: lang.value.invoice.messages.cancelInvoice({
        clientDetails: data.clientDetails,
        totalIncludingTax: format(data.totalIncludingTax)
      })
    })
    .onOk(async () => {
      const result = useMutation('admin.cancelInvoice', {
        args: {
          id: data.id
        },
        immediate: true
      })
      await result.immediatePromise

      if (!result.error.value) {
        await execute()
      }
    })
}

const openSendBillDialog = (
  type: 'bill' | 'receipt'
): InstanceType<typeof InvoiceExpansionItem>['$props']['onSend'] => {
  return async ({ data, done }) => {
    const result = useQuery('admin.getInvoiceEmail', {
      args: {
        id: data.id,
        type,
        action: 'send'
      },
      immediate: true
    })

    await result.immediatePromise

    if (
      sendBillDialogRef?.value &&
      result.data.value?.subject &&
      result.data.value?.body
    ) {
      sendBillEmailType.value = type === 'bill' ? 'sendBill' : 'sendReceipt'
      sendBillEmailId.value = data.id
      sendBillEmailSubject.value = result.data.value.subject
      sendBillEmailBody.value = result.data.value.body
      sendBillDialogRef.value.functions.open()
    }

    done(!result.error.value)
  }
}

const sendBillEmailType = ref<'sendBill' | 'sendReceipt'>('sendBill')
const sendBillEmailId = ref(NaN)
const sendBillEmailSubject = ref('')
const sendBillEmailBody = ref('')

const sendBillDialogRef = ref<typeof ResponsiveDialog>()

const sendMutations = {
  sendBill: 'admin.sendBill',
  sendReceipt: 'admin.sendReceipt'
} as const

const sendBill: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const result = useMutation(sendMutations[sendBillEmailType.value], {
    args: {
      id: sendBillEmailId.value,
      emailSubject: sendBillEmailSubject.value,
      emailBody: sendBillEmailBody.value
    },
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
  if (!result.error.value) {
    sendBillEmailType.value = 'sendBill'
    sendBillEmailId.value = NaN
    sendBillEmailSubject.value = ''
    sendBillEmailBody.value = ''
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
