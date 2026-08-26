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
          <boolean-select v-model="paid" :label="lang.invoice.status.paid" />
          <!-- <invoice-status-select v-model="status" /> -->
        </q-menu>
      </q-btn>
    </q-toolbar>
    <div v-if="ready" class="row">
      <q-list class="full-width" dense>
        <invoice-expansion-item
          v-for="invoice in invoices"
          :key="invoice.id"
          :model-value="invoice"
          v-on="invoiceExpansionItemHandlers"
        />
        <q-item v-if="!invoices?.length" class="flex flex-center text-grey-6">
          <q-item-section class="text-center">
            {{ lang.noResultsAvailable }}
          </q-item-section>
        </q-item>
      </q-list>
    </div>
    <div class="grid grid-cols-12 items-center gap-3 q-mt-md">
      <div class="col-span-12 md:col-span-3">
        <q-select
          v-model="rowsPerPage"
          :options="[5, 10, 15, 25, 50]"
          :label="lang.rowsPerPage"
          dense
          outlined
        />
      </div>
      <div class="col-span-12 md:col-span-6 flex justify-center">
        <q-pagination
          v-model="page"
          :disable="!(total && page && rowsPerPage)"
          :max="Math.ceil(total / rowsPerPage)"
          :max-pages="5"
          direction-links
        />
      </div>
    </div>
  </q-page>
  <responsive-dialog
    ref="updateDialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
    persistent
    @submit="update"
  >
    <invoice-form
      v-if="filteredCompanies && filteredClients"
      ref="updateInvoiceFormRef"
      :filtered-companies="filteredCompanies"
      :filtered-clients="filteredClients"
      :filtered-number-prefixes="numberPrefixes || []"
      @submit="updateInvoice"
      @filter:companies="onFilterCompanies"
      @filter:clients="onFilterClients"
    ></invoice-form>
  </responsive-dialog>
  <responsive-dialog
    ref="createDialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
    persistent
    @submit="create"
  >
    <invoice-form
      v-if="filteredCompanies && filteredClients"
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
    ref="sendEmailDialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
    button-type="send"
    persistent
    @submit="sendBill"
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
import { ref, onMounted, computed, watch, inject } from 'vue'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import { EmailInput, BooleanSelect } from '@simsustech/quasar-components/form'
import InvoiceForm from '../../../components/invoice/InvoiceForm.vue'
import InvoiceExpansionItem from '../../../components/invoice/InvoiceExpansionItem.vue'
import { useLang } from '../../../lang/index.js'

import {
  InvoiceStatus,
  PaymentMethod
} from '@modular-api/fastify-checkout/types'

import { useQuasar, QSelect } from 'quasar'
import CompanySelect from '../../../components/company/CompanySelect.vue'
import ClientSelect from '../../../components/client/ClientSelect.vue'
import AddPaymentDialog from '../../../components/AddPaymentDialog.vue'
import { onBeforeRouteUpdate, useRoute } from 'vue-router'
import { useConfiguration } from '../../../configuration.js'
import { EventBus } from 'quasar'
import { useAdminGetBillsQuery } from '../../../queries/admin/bills.js'
import { useAdminGetNumberPrefixesQuery } from '../../../queries/admin/numberPrefixes.js'
import {
  useAdminGetInvoiceEmailQuery,
  useAdminSendBillMutation,
  useAdminSendReceiptMutation
} from '../../../queries/admin/email.js'
import {
  useAdminAddPaymentToInvoiceMutation,
  useAdminDeletePaymentFromInvoiceMutation,
  useAdminCancelInvoiceMutation,
  useAdminCreateInvoiceMutation,
  useAdminUpdateInvoiceMutation
} from '../../../queries/admin/invoices.js'
import { useAdminSearchCompaniesQuery } from '../../../queries/admin/companies.js'
import { useAdminSearchClientsQuery } from '../../../queries/admin/clients.js'
import { until } from '@vueuse/core'

const bus = inject<EventBus>('bus')!
bus.on('administrator-open-bills-create-dialog', () => {
  if (openCreateDialog)
    openCreateDialog({
      done: () => {}
    })
})

const configuration = useConfiguration()

const $q = useQuasar()
const lang = useLang()

const route = useRoute()

onBeforeRouteUpdate((to) => {
  if (to.params.uuids && Array.isArray(to.params.uuids)) {
    uuids.value = to.params.uuids as string[]
  } else {
    uuids.value = undefined
  }
})

const {
  bills: invoices,
  companyId,
  clientId,
  clientDetails,
  uuids,
  page,
  rowsPerPage,
  paid,
  refetch: execute
} = useAdminGetBillsQuery()

if (route.params.uuids && Array.isArray(route.params.uuids)) {
  uuids.value = route.params.uuids as string[]
}

const total = computed(() => invoices.value?.at(0)?.total || 0)

const { numberPrefixes, refetch: refetchNumberPrefixes } =
  useAdminGetNumberPrefixesQuery()
await refetchNumberPrefixes()

const { mutateAsync: updateInvoiceMutation } = useAdminUpdateInvoiceMutation()
const { mutateAsync: createInvoiceMutation } = useAdminCreateInvoiceMutation()

const updateInvoiceFormRef = ref<typeof InvoiceForm>()
const createInvoiceFormRef = ref<typeof InvoiceForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onUpdate'] = async ({ data }) => {
  // @ts-expect-error untyped
  companiesSearchPhrase.value = data?.companyDetails?.name
  clientName.value =
    // @ts-expect-error untyped
    data?.clientDetails?.contactPersonName ?? data?.clientDetails?.companyName

  updateDialogRef.value?.functions.open()

  await until(updateInvoiceFormRef).toBeTruthy()
  await until(filteredClientsAsyncStatus).toBe('idle')
  await until(filteredCompaniesAsyncStatus).toBe('idle')

  updateInvoiceFormRef.value?.functions.setValue(data)
}

const openCreateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onCreate'] = () => {
  createDialogRef.value?.functions.open()
}

const update: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterUpdate = async (success?: boolean) => {
    done(success)
    await execute()
  }
  updateInvoiceFormRef.value?.functions.submit({ done: afterUpdate })
}

const create: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterCreate = async (success?: boolean) => {
    done(success)
    if (success) await execute()
  }
  createInvoiceFormRef.value?.functions.submit({ done: afterCreate })
}

const updateInvoice: InstanceType<
  typeof InvoiceForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    await updateInvoiceMutation(data)

    done()
    await execute()
  } catch (e) {}
}

const createInvoice: InstanceType<
  typeof InvoiceForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    await createInvoiceMutation({ ...data, status: InvoiceStatus.BILL })

    done()
    await execute()
  } catch (e) {}
}

const {
  companies: filteredCompanies,
  searchPhrase: companiesSearchPhrase,
  refetch: refetchFilteredCompanies,
  asyncStatus: filteredCompaniesAsyncStatus
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
  refetch: refetchFilteredClients,
  asyncStatus: filteredClientsAsyncStatus
} = useAdminSearchClientsQuery()

// const filteredClients = ref<ClientDetails>([])
const onFilterClients: InstanceType<
  typeof InvoiceForm
>['$props']['onFilter:clients'] = async ({ searchPhrase, done }) => {
  clientName.value = searchPhrase
  await refetchFilteredClients()

  if (done) done()
}

const { mutateAsync: addPaymentToInvoiceMutation } =
  useAdminAddPaymentToInvoiceMutation()

const { mutateAsync: deletePaymentFromInvoiceMutation } =
  useAdminDeletePaymentFromInvoiceMutation()

const formatPaymentDate = (date: string) =>
  new Intl.DateTimeFormat($q.lang.isoName, { dateStyle: 'short' }).format(
    new Date(date)
  )

const openDeletePaymentDialog = async ({
  data
}: {
  data: {
    id: number
    invoiceId?: number | null
    method?: string
    amount?: number
    currency?: string
  }
}) => {
  // Descriptive confirmation to prevent deleting the wrong payment.
  const invoice = invoices.value?.find((item) => item.id === data.invoiceId)
  const methodLabels: Record<string, string> = {
    cash: lang.value.payment.methods.cash,
    banktransfer: lang.value.payment.methods.bankTransfer,
    pin: lang.value.payment.methods.pin
  }
  const formattedAmount = Intl.NumberFormat($q.lang.isoName, {
    maximumFractionDigits: 2,
    style: 'currency',
    currency: data.currency ?? 'EUR'
  }).format((data.amount ?? 0) / 100)
  return $q
    .dialog({
      message: lang.value.payment.confirmDeletePayment({
        method: methodLabels[data.method ?? ''] ?? data.method ?? '',
        number: invoice ? `${invoice.numberPrefix}${invoice.number}` : '',
        amount: formattedAmount
      }),
      cancel: true
    })
    .onOk(async () => {
      try {
        await deletePaymentFromInvoiceMutation({
          id: data.invoiceId as number,
          paymentId: data.id
        })
        await execute()
      } catch (e) {}
    })
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
      component: AddPaymentDialog,
      componentProps: {
        message: lang.value.invoice.messages.addCashPayment({
          clientDetails: data.clientDetails,
          totalIncludingTax: format(data.totalIncludingTax)
        }),
        currency: data.currency,
        totalIncludingTax: data.totalIncludingTax
      }
    })
    .onOk(async ({ amount, date }) => {
      try {
        await addPaymentToInvoiceMutation({
          id: data.id,
          payment: {
            amount,
            currency: data.currency,
            description: `${lang.value.payment.descriptions.cashPayment} ${formatPaymentDate(date)}`,
            date,
            method: PaymentMethod.cash
          }
        })
        await execute()
      } catch (e) {}
    })
}

const openAddBankTransferPaymentDialog: InstanceType<
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
        message: lang.value.invoice.messages.addBankTransferPayment({
          clientDetails: data.clientDetails,
          totalIncludingTax: format(data.totalIncludingTax)
        }),
        currency: data.currency,
        totalIncludingTax: data.totalIncludingTax
      }
    })
    .onOk(async ({ amount, transactionReference, date }) => {
      try {
        await addPaymentToInvoiceMutation({
          id: data.id,
          payment: {
            amount,
            currency: data.currency,
            description: `${lang.value.payment.descriptions.bankTransferPayment} ${formatPaymentDate(date)}`,
            date,
            transactionReference,
            method: PaymentMethod.banktransfer
          }
        })
        await execute()
      } catch (e) {}
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
        currency: data.currency,
        totalIncludingTax: data.totalIncludingTax
      }
    })
    .onOk(async ({ amount, transactionReference, date }) => {
      try {
        await addPaymentToInvoiceMutation({
          id: data.id,
          payment: {
            amount,
            currency: data.currency,
            description: `${lang.value.payment.descriptions.pinPayment} ${formatPaymentDate(date)}`,
            date,
            transactionReference,
            method: PaymentMethod.pin
          }
        })
        await execute()
      } catch (e) {}
    })
}

const openAddWeroPaymentDialog: InstanceType<
  typeof InvoiceExpansionItem
>['$props']['onAddPaymentWero'] = async ({ data, done }) => {
  try {
    const result = await addPaymentToInvoiceMutation({
      id: data.id,
      payment: {
        amount: data.amountDue || data.totalIncludingTax,
        currency: data.currency,
        description: `Wero payment ${new Date().toISOString().slice(0, 10)}`,
        method: PaymentMethod.wero
      }
    })
    if (result?.checkoutUrl) {
      await navigator.clipboard.writeText(result.checkoutUrl)
      $q.notify({
        message: 'Checkout URL copied to clipboard',
        color: 'positive'
      })
    }
    await execute()
  } catch (e) {
    console.error(e)
  }
}

const openAddCreditcardPaymentDialog: InstanceType<
  typeof InvoiceExpansionItem
>['$props']['onAddPaymentCreditcard'] = async ({ data, done }) => {
  try {
    const result = await addPaymentToInvoiceMutation({
      id: data.id,
      payment: {
        amount: data.amountDue || data.totalIncludingTax,
        currency: data.currency,
        description: `Credit card payment ${new Date().toISOString().slice(0, 10)}`,
        method: PaymentMethod.creditcard
      }
    })
    if (result?.checkoutUrl) {
      await navigator.clipboard.writeText(result.checkoutUrl)
      $q.notify({
        message: 'Checkout URL copied to clipboard',
        color: 'positive'
      })
    }
    await execute()
  } catch (e) {
    console.error(e)
  }
}

const { mutateAsync: cancelInvoiceMutation } = useAdminCancelInvoiceMutation()

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
      try {
        await cancelInvoiceMutation({
          id: data.id
        })
        await execute()
      } catch (e) {}
    })
}

const openSendEmailDialog = (
  type: 'bill' | 'receipt'
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

// const sendBillEmailType = ref<'sendBill' | 'sendReceipt'>('sendBill')
// const sendBillEmailId = ref(NaN)

const sendEmailDialogRef = ref<typeof ResponsiveDialog>()

const { mutateAsync: sendBillMutation } = useAdminSendBillMutation()
const { mutateAsync: sendReceiptMutation } = useAdminSendReceiptMutation()

const sendMutations = {
  bill: sendBillMutation,
  receipt: sendReceiptMutation,
  invoice: () => {}
} as const

const sendBill: InstanceType<
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
  } catch (e) {
    console.error(e)
  }
}

const onNewValueClients: QSelect['$props']['onNewValue'] = (input) => {
  clientId.value = NaN
  clientDetails.value.name = input
}

watch(clientId, (newVal) => {
  if (newVal) clientDetails.value.name = null
})

watch(rowsPerPage, () => {
  page.value = 1
})

const invoiceExpansionItemHandlers = computed(() => ({
  send: openSendEmailDialog('bill'),
  update: openUpdateDialog,
  sendReceipt: openSendEmailDialog('receipt'),
  addPaymentPin: configuration.value.PAYMENT_HANDLERS.pin
    ? openAddPinPaymentDialog
    : undefined,
  addPaymentCash: configuration.value.PAYMENT_HANDLERS.cash
    ? openAddCashPaymentDialog
    : undefined,
  addPaymentBankTransfer: configuration.value.PAYMENT_HANDLERS.bankTransfer
    ? openAddBankTransferPaymentDialog
    : undefined,
  addPaymentWero: configuration.value.PAYMENT_HANDLERS.wero
    ? openAddWeroPaymentDialog
    : undefined,
  addPaymentCreditcard: configuration.value.PAYMENT_HANDLERS.creditcard
    ? openAddCreditcardPaymentDialog
    : undefined,
  cancel: openCancelDialog,
  deletePayment: openDeletePaymentDialog
}))

const activeSearch = computed(
  () =>
    !Number.isNaN(companyId.value) ||
    !Number.isNaN(clientId.value) ||
    paid.value !== void 0
)
const clearSearchResults = () => {
  companyId.value = NaN
  clientId.value = NaN
  paid.value = undefined
}

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  await refetchFilteredClients()
  await refetchFilteredCompanies()
  ready.value = true
})
</script>
