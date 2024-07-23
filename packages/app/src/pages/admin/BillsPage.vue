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
        <q-menu>
          <div class="q-pa-sm">
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
            <!-- <invoice-status-select v-model="status" /> -->
          </div>
        </q-menu>
      </q-btn>
    </template>
    <div v-if="ready" class="row">
      <q-list class="full-width" dense>
        <invoice-expansion-item
          v-for="invoice in invoices"
          :key="invoice.id"
          :model-value="invoice"
          @send="($event) => openSendBillDialog('sendBill')!($event)"
          @update="openUpdateDialog"
          @send-receipt="($event) => openSendBillDialog('sendReceipt')!($event)"
          @add-payment-cash="openAddCashPaymentDialog"
          @cancel="openCancelDialog"
        />
      </q-list>
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
import { ref, nextTick, onMounted, reactive } from 'vue'
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
import { PaymentMethod } from '@modular-api/fastify-checkout/types'
import { InvoiceStatus } from '@slimfact/api/zod'

import { useQuasar } from 'quasar'
import CompanySelect from '../../components/company/CompanySelect.vue'
import ClientSelect from '../../components/client/ClientSelect.vue'
import PriceInputDialog from 'src/components/PriceInputDialog.vue'

const { useQuery, useMutation } = await createUseTrpc()

const $q = useQuasar()
const lang = useLang()

const companyId = ref(NaN)
const clientId = ref(NaN)
const status = ref<InvoiceStatus | null>(InvoiceStatus.BILL)

const { data: invoices, execute } = useQuery('admin.getInvoices', {
  args: reactive({
    companyId,
    clientId,
    status
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
  type: 'sendBill' | 'sendReceipt'
): InstanceType<typeof InvoiceExpansionItem>['$props']['onSend'] => {
  return async ({ data, done }) => {
    const result = useQuery('admin.getInvoiceEmail', {
      args: {
        id: data.id,
        type
      },
      immediate: true
    })

    await result.immediatePromise

    if (
      sendBillDialogRef?.value &&
      result.data.value?.subject &&
      result.data.value?.body
    ) {
      sendBillEmailType.value = type
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

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
