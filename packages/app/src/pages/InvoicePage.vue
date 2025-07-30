<template>
  <q-layout>
    <q-header class="no-print">
      <q-toolbar>
        <div
          v-if="
            invoice &&
            invoice.status &&
            invoice.status !== InvoiceStatus.CONCEPT
          "
          class="row justify-center no-print q-pt-md q-mb-md q-gutter-x-sm"
        >
          <q-btn-dropdown
            v-if="
              invoice &&
              [InvoiceStatus.OPEN, InvoiceStatus.BILL].includes(
                invoice.status
              ) &&
              invoice.amountDue &&
              invoice.amountDue > 0
            "
            icon="i-mdi-payment"
            :label="lang.payment.pay"
            color="primary"
          >
            <q-list>
              <q-item
                v-if="configuration.PAYMENT_HANDLERS.ideal"
                clickable
                @click="payWithIdeal"
              >
                <q-item-section avatar>
                  <q-icon name="i-fa6-brands-ideal" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> iDEAL </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-if="
                  configuration.PAYMENT_HANDLERS.bankTransfer &&
                  invoice.status === InvoiceStatus.OPEN &&
                  qrSvg
                "
                clickable
                @click="openBankTransferDialog"
              >
                <q-item-section avatar>
                  <q-icon name="i-fa6-solid-money-bill-transfer" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.payment.methods.bankTransfer }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>

          <q-btn-dropdown
            v-if="
              invoice &&
              [InvoiceStatus.OPEN, InvoiceStatus.BILL].includes(
                invoice.status
              ) &&
              invoice.requiredDownPaymentAmount &&
              invoice.requiredDownPaymentAmount > (invoice.amountPaid || 0)
            "
            icon="i-mdi-payment"
            :label="`${lang.payment.downPayment} ${format(invoice.requiredDownPaymentAmount - (invoice.amountPaid || 0))}`"
            color="primary"
          >
            <q-list>
              <q-item
                v-if="configuration.PAYMENT_HANDLERS.ideal"
                clickable
                @click="payDownPaymentWithIdeal"
              >
                <q-item-section avatar>
                  <q-icon name="i-fa6-brands-ideal" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> iDEAL </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>

          <q-btn
            v-if="
              invoice &&
              invoice.amountDue !== void 0 &&
              invoice.amountDue !== null &&
              invoice.amountDue < 0 &&
              user?.roles?.includes('administrator')
            "
            :label="`${lang.refund.refund} ${format(-invoice.amountDue)}`"
            color="primary"
            @click="refund"
          />

          <q-btn
            v-if="invoice"
            icon="i-mdi-download"
            color="primary"
            download="proposed_file_name"
            :href="`${slimfactDownloaderUrl}/?uuid=${invoice.uuid}&host=${host}`"
          >
            <q-tooltip class="no-print">
              {{ lang.invoice.labels.download }}
            </q-tooltip>
          </q-btn>
          <q-btn
            v-if="invoice"
            icon="i-mdi-printer"
            color="primary"
            @click="print"
          >
            <q-tooltip class="no-print">
              {{ lang.invoice.labels.print }}
            </q-tooltip>
          </q-btn>

          <q-btn
            v-if="user?.roles?.includes('administrator')"
            color="primary"
            icon="i-mdi-open-in-new"
            :to="getAdminUrl()"
          />
          <q-btn v-else color="primary" icon="i-mdi-home" to="/" />
        </div>
      </q-toolbar>
      <q-toolbar inset>
        <div
          v-if="
            invoice?.amountPaid &&
            invoice?.amountPaid > 0 &&
            invoice?.status &&
            invoice.status !== InvoiceStatus.CONCEPT
          "
          class="row justify-center no-print"
        >
          {{ lang.payment.amountPaid }}:
          <price
            :model-value="invoice.amountPaid"
            :currency="invoice.currency"
            :locale="invoice.locale"
          />
        </div>
        <div
          v-if="invoice?.amountRefunded && invoice?.amountRefunded > 0"
          class="row justify-center no-print"
        >
          {{ lang.payment.amountRefunded }}:
          <price
            :model-value="invoice.amountRefunded"
            :currency="invoice.currency"
            :locale="invoice.locale"
          />
        </div>
        <div
          v-if="invoice?.amountDue && invoice?.amountDue > 0"
          class="row justify-center no-print"
        >
          {{ lang.payment.amountDue }}:
          <price
            :model-value="invoice.amountDue"
            :currency="invoice.currency"
            :locale="invoice.locale"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <div class="row justify-center">
        <q-scroll-area class="no-print" style="height: 297mm; width: 212mm">
          <invoice-page
            v-if="invoice"
            id="invoice"
            ref="invoiceRef"
            :model-value="invoice"
            :include-tax="
              [InvoiceStatus.BILL, InvoiceStatus.RECEIPT].includes(
                invoice.status
              )
            "
          />
        </q-scroll-area>
      </div>

      <invoice-page
        v-if="invoice"
        id="invoice"
        ref="invoiceRef"
        class="invisible print:!visible"
        :model-value="invoice"
        :include-tax="
          [InvoiceStatus.BILL, InvoiceStatus.RECEIPT].includes(invoice.status)
        "
      />
      <responsive-dialog
        :icons="{ close: 'i-mdi-close' }"
        class="no-print"
        padding
        ref="bankTransferDialogRef"
        display
      >
        <div v-if="invoice && qrSvg">
          {{ lang.payment.messages.scanQrOrUseInformationBelow }}
          <div
            id="qrcode"
            style="max-width: 5cm; max-height: 5cm"
            v-html="qrSvg"
          ></div>
          <div>
            {{ lang.company.fields.name }}: {{ invoice?.companyDetails.name }}
          </div>
          <div>
            {{ lang.company.fields.iban }}: {{ invoice?.companyDetails.iban }}
          </div>
          <div>
            {{ lang.company.fields.bic }}: {{ invoice?.companyDetails.bic }}
          </div>
          <div>{{ lang.payment.fields.description }}: {{ description }}</div>
          <price
            :currency="invoice.currency"
            :model-value="invoice.amountDue"
          />
        </div>
      </responsive-dialog>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { InvoicePage } from '@modular-api/quasar-components/checkout'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLang, loadLang } from './../lang/index.js'
import { useMeta, useQuasar } from 'quasar'
import { InvoiceStatus } from '@slimfact/api/zod'
import { generateEpcQrCodeData } from '@slimfact/tools/epc-qr'
import { renderSVG } from 'uqr'
import { ResponsiveDialog } from '@simsustech/quasar-components'
import Price from '../components/Price.vue'
import { loadConfiguration, useConfiguration } from '../configuration.js'
import { useOAuthClient, user, oAuthClient } from '../oauth.js'
import { useQuery } from '@pinia/colada'
import { initializeTRPCClient, trpc } from '../trpc.js'
import {
  usePublicPayDownPaymentWithIdealMutation,
  usePublicPayWithIdealMutation
} from 'src/queries/public/invoices.js'
import { useAdminRefundInvoiceMutation } from 'src/queries/admin/invoices.js'
import { loadLang as loadFormLang } from '@simsustech/quasar-components/form'
import { loadLang as loadCheckoutLang } from '@modular-api/quasar-components/checkout'
import { loadLang as loadGeneralLang } from '@simsustech/quasar-components'
import { useAccountInvoiceEventEmailOpenedMutation } from 'src/mutations/account/invoiceEvent.js'

const $q = useQuasar()
const language = ref($q.lang.isoName)
const lang = useLang()

watch(language, (newVal) => {
  loadLang(newVal)
  loadFormLang(newVal)
  loadCheckoutLang(newVal)
  loadGeneralLang(newVal)

  // @ts-expect-error string
  languageImports.value[newVal]().then((lang) => {
    $q.lang.set(lang.default)
  })
})

await loadConfiguration(language)
const configuration = useConfiguration()
await initializeTRPCClient(configuration.value.API_HOST)

const route = useRoute()
const host = ref(import.meta.env.SSR ? '' : window.location.host)
const slimfactDownloaderUrl = ref(
  import.meta.env.VITE_SLIMFACT_DOWNLOADER_HOST
    ? `http://${import.meta.env.VITE_SLIMFACT_DOWNLOADER_HOST}`
    : 'https://download.slimfact.app'
)

const uuid = ref(
  Array.isArray(route.params.uuid) ? route.params.uuid[0] : route.params.uuid
)

const { data: invoice, refetch } = useQuery({
  enabled: !import.meta.env.SSR,
  key: ['publicGetInvoice', uuid.value],
  query: () =>
    trpc.public.getInvoice.query({
      uuid: uuid.value
    })
})
await refetch()

// const { data: invoice } = useQuery('public.getInvoice', {
//   args: reactive({
//     uuid
//   }),
//   immediate: true
// })

watch(invoice, (newVal) => {
  if (newVal?.locale) {
    loadLang(newVal.locale)
  }
})

useMeta(() => {
  let title
  if (invoice.value && invoice.value?.status === InvoiceStatus.RECEIPT) {
    title = `${lang.value.receipt.receipt} ${invoice.value.companyDetails.name || invoice.value.companyDetails.contactPersonName}.pdf`
  } else if (invoice.value && invoice.value?.status === InvoiceStatus.BILL) {
    title = `${lang.value.bill.bill} ${invoice.value.companyDetails.name || invoice.value.companyDetails.contactPersonName}.pdf`
  } else if (invoice.value && invoice.value?.status === InvoiceStatus.CONCEPT) {
    title = `${invoice.value.companyDetails.name}
      ${lang.value.invoice.status.concept}
      .pdf`
  } else if (invoice.value) {
    title = `${invoice.value.date} ${invoice.value.companyDetails.name}
      ${lang.value.invoice.invoice}
      ${invoice.value.numberPrefix}${invoice.value.number}.pdf`
  }
  return {
    title: title || 'SlimFact'
  }
})

const description = computed(() => {
  if (invoice.value) {
    return invoice.value.status === InvoiceStatus.OPEN
      ? `${lang.value.invoice.invoice}
      ${invoice.value.numberPrefix}${invoice.value.number}`
      : invoice.value.uuid
  }
  return ''
})

const qrSvg = computed(() => {
  if (invoice.value) {
    try {
      const data = generateEpcQrCodeData({
        name: invoice.value.companyDetails.name,
        bic: invoice.value.companyDetails.bic,
        iban: invoice.value.companyDetails.iban,
        amount: invoice.value.amountDue || 0,
        currency: invoice.value.currency,
        information: description.value,
        unstructuredReference: invoice.value.uuid
      })
      return renderSVG(data)
    } catch (e) {
      return null
    }
  }
  return null
})

const invoiceRef = ref()

const { mutateAsync: payWithIdealMutation } = usePublicPayWithIdealMutation()
const { mutateAsync: payDownPaymentWithIdealMutation } =
  usePublicPayDownPaymentWithIdealMutation()
const { mutateAsync: refundInvoiceMutation } = useAdminRefundInvoiceMutation()

const payWithIdeal = async () => {
  try {
    const result = await payWithIdealMutation(uuid.value)

    if (result) window.location.href = result
  } catch (e) {}
}

const payDownPaymentWithIdeal = async () => {
  try {
    const result = await payDownPaymentWithIdealMutation(uuid.value)

    if (result) window.location.href = result
  } catch (e) {}
}

const refund = async () => {
  if (invoice.value?.amountDue && invoice.value.amountDue < 0) {
    $q.dialog({
      message: lang.value.refund.messages.confirmRefund(
        format(-invoice.value.amountDue)
      ),
      cancel: true
    }).onOk(async () => {
      if (invoice.value?.id) {
        try {
          refundInvoiceMutation(invoice.value.id)
          window.location.reload()
        } catch (e) {}
      }
    })
  }
}

const bankTransferDialogRef = ref<typeof ResponsiveDialog>()
const openBankTransferDialog = () => {
  bankTransferDialogRef.value?.functions.open()
}

const print = () => {
  if (!import.meta.env.SSR) {
    window.print()
  }
}

const format = (value: number) =>
  Intl.NumberFormat(invoice.value?.locale || $q.lang.isoName, {
    maximumFractionDigits: 2,
    style: 'currency',
    currency: invoice.value?.currency
  }).format(value / 100)

const getAdminUrl = () => {
  if (invoice.value) {
    const statusRouteMap = {
      [InvoiceStatus.BILL]: 'bills',
      [InvoiceStatus.RECEIPT]: 'receipts',
      [InvoiceStatus.CONCEPT]: 'invoices',
      [InvoiceStatus.OPEN]: 'invoices',
      [InvoiceStatus.PAID]: 'invoices',
      [InvoiceStatus.CANCELED]: 'invoices'
    }
    return `/admin/${statusRouteMap[invoice.value.status]}/${invoice.value.uuid}`
  }
  return
}

const { mutateAsync: invoiceEventEmailOpenedMutation } =
  useAccountInvoiceEventEmailOpenedMutation()

onMounted(async () => {
  if (__IS_PWA__) {
    await import('../pwa.js')
  }

  await useOAuthClient()

  try {
    await oAuthClient.value?.signInSilently({})
  } catch (e) {
    console.error('Failed to sign in silently')
  }

  await oAuthClient.value?.getUserInfo()

  if (oAuthClient.value?.getAccessToken()) {
    user.value = await oAuthClient.value?.getUser()
  }

  if (route.query?.eventType === 'emailOpened' && invoice.value) {
    invoiceEventEmailOpenedMutation({ invoiceId: invoice.value.id })
  }
})
</script>

<style>
@page {
  size: a4;
  margin-top: 15mm;
  margin-left: 15mm;
}
@media print {
  .no-print,
  .no-print * {
    display: none !important;
  }
  #invoice {
    margin-top: -76px;
    padding: 0;
    padding: 0 !important;
    border: none !important;
  }
}
#invoice {
  padding: 15mm;
  border: 1px solid grey;
}
</style>
