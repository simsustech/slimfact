<template>
  <div class="row justify-center no-print q-mb-md q-gutter-x-sm">
    <q-btn
      v-if="
        invoice &&
        [InvoiceStatus.OPEN, InvoiceStatus.BILL].includes(invoice.status) &&
        invoice.amountDue
      "
      icon="payment"
      :label="lang.payment.pay"
      color="primary"
    >
      <q-menu>
        <q-list>
          <q-item
            v-if="configuration.PAYMENT_HANDLERS.ideal"
            clickable
            @click="payWithIdeal"
          >
            <q-item-section avatar>
              <q-icon name="fa-brands fa-ideal" />
            </q-item-section>
            <q-item-section>
              <q-item-label> iDEAL </q-item-label>
            </q-item-section>
          </q-item>
          <q-item
            v-if="
              configuration.PAYMENT_HANDLERS.bankTransfer &&
              invoice.status === InvoiceStatus.OPEN
            "
            clickable
            @click="openBankTransferDialog"
          >
            <q-item-section avatar>
              <q-icon name="fa-solid fa-money-bill-transfer" />
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{ lang.payment.methods.bankTransfer }}
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item
            v-if="
              configuration.PAYMENT_HANDLERS.smartpin &&
              isMobile &&
              user?.roles?.includes('pointofsale')
            "
            clickable
            @click="payWithSmartpin"
          >
            <q-item-section avatar>
              <q-icon name="credit_card" />
            </q-item-section>
            <q-item-section>
              <q-item-label> SmartPin </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <q-btn
      v-if="
        invoice &&
        [InvoiceStatus.OPEN, InvoiceStatus.BILL].includes(invoice.status) &&
        invoice.requiredDownPaymentAmount &&
        invoice.requiredDownPaymentAmount > (invoice.amountPaid || 0)
      "
      icon="payment"
      :label="`${lang.payment.downPayment} ${format(invoice.requiredDownPaymentAmount - (invoice.amountPaid || 0))}`"
      color="primary"
    >
      <q-menu>
        <q-list>
          <q-item
            v-if="configuration.PAYMENT_HANDLERS.ideal"
            clickable
            @click="payDownPaymentWithIdeal"
          >
            <q-item-section avatar>
              <q-icon name="fa-brands fa-ideal" />
            </q-item-section>
            <q-item-section>
              <q-item-label> iDEAL </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <q-btn
      v-if="
        invoice &&
        invoice.amountDue &&
        invoice.amountDue < 0 &&
        user?.roles?.includes('administrator')
      "
      :label="`${lang.refund.refund} ${format(-invoice.amountDue)}`"
      color="primary"
      @click="refund"
    />
    <q-btn
      v-if="invoice"
      icon="download"
      :label="lang.invoice.labels.download"
      color="primary"
      download="proposed_file_name"
      :href="`${slimfactDownloaderUrl}/?uuid=${invoice.uuid}&host=${hostname}`"
    />
    <q-btn
      v-if="invoice"
      icon="print"
      :label="lang.invoice.labels.print"
      color="primary"
      @click="print"
    />
  </div>

  <div
    v-if="invoice?.amountPaid && invoice?.amountPaid > 0"
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

  <div v-if="invoice" class="row justify-center">
    <q-scroll-area :style="scrollAreaSize">
      <q-resize-observer @resize="onResize" />
      <invoice-page
        id="invoice"
        ref="invoiceRef"
        :model-value="invoice"
        :include-tax="
          [InvoiceStatus.BILL, InvoiceStatus.RECEIPT].includes(invoice.status)
        "
      />
    </q-scroll-area>
  </div>

  <responsive-dialog ref="bankTransferDialogRef">
    <div v-if="invoice">
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
      <price :currency="invoice.currency" :model-value="invoice.amountDue" />
    </div>
  </responsive-dialog>
</template>

<script setup lang="ts">
import { InvoicePage } from '@modular-api/quasar-components/checkout'
import { createUseTrpc } from '../trpc.js'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLang, loadLang } from './../lang/index.js'
import { QResizeObserver, useMeta, useQuasar } from 'quasar'
import { InvoiceStatus } from '@slimfact/api/zod'
import { generateEpcQrCodeData } from '@slimfact/tools/epc-qr'
import { renderSVG } from 'uqr'
import { ResponsiveDialog } from '@simsustech/quasar-components'
import Price from '../components/Price.vue'
import { loadConfiguration, useConfiguration } from '../configuration.js'
import { useOAuthClient, user, oAuthClient } from '../oauth.js'

const { useQuery, useMutation } = await createUseTrpc()
const lang = useLang()
const $q = useQuasar()
const configuration = useConfiguration()
const route = useRoute()
const hostname = ref(import.meta.env.SSR ? '' : window.location.host)
const slimfactDownloaderUrl = ref(
  import.meta.env.VITE_SLIMFACT_DOWNLOADER_HOSTNAME
    ? `http://${import.meta.env.VITE_SLIMFACT_DOWNLOADER_HOSTNAME}`
    : 'https://download.slimfact.app'
)

const uuid = ref(
  Array.isArray(route.params.uuid) ? route.params.uuid[0] : route.params.uuid
)
const { data: invoice } = useQuery('public.getInvoice', {
  args: reactive({
    uuid
  }),
  immediate: true
})

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
    const data = generateEpcQrCodeData({
      name: invoice.value.companyDetails.name,
      bic: 'RABONL2U' || invoice.value.companyDetails.bic,
      iban: 'NL82RABO6579776978' || invoice.value.companyDetails.iban,
      amount: invoice.value.amountDue,
      currency: invoice.value.currency,
      information: description.value,
      unstructuredReference: invoice.value.uuid
    })
    return renderSVG(data)
  }
  return null
})

const invoiceRef = ref()

const payWithIdeal = async () => {
  const result = useMutation('public.payWithIdeal', {
    args: {
      uuid: uuid.value
    },
    immediate: true
  })

  await result.immediatePromise

  if (result.data.value) window.location.href = result.data.value
}

const payDownPaymentWithIdeal = async () => {
  const result = useMutation('public.payDownPaymentWithIdeal', {
    args: {
      uuid: uuid.value
    },
    immediate: true
  })

  await result.immediatePromise

  if (result.data.value) window.location.href = result.data.value
}

const payWithSmartpin = async () => {
  const result = useMutation('public.payWithSmartpin', {
    args: {
      uuid: uuid.value
    },
    immediate: true
  })

  await result.immediatePromise

  if (result.data.value) window.location.href = result.data.value
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
        const result = useMutation('admin.refundInvoice', {
          args: {
            id: invoice.value.id
          },
          immediate: true
        })

        await result.immediatePromise

        if (!result.error.value) window.location.reload()
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

const isMobile = computed(() => {
  if (import.meta.env.SSR) return false
  return /Android|iPhone|iPad/i.test(window.navigator.userAgent)
})

const scrollAreaSize = ref({
  width: '100%',
  'max-width': '210mm',
  height: '200px'
})
const minWidth = 210
const onResize: InstanceType<typeof QResizeObserver>['$props']['onResize'] = (
  size
) => {
  scrollAreaSize.value.width = size.width > minWidth ? '100%' : `${minWidth}px`
  scrollAreaSize.value.height = `${size.height}px`
}

const format = (value: number) =>
  Intl.NumberFormat(invoice.value?.locale || $q.lang.isoName, {
    maximumFractionDigits: 2,
    style: 'currency',
    currency: invoice.value?.currency
  }).format(value / 100)

const language = ref($q.lang.isoName)
onMounted(async () => {
  await loadConfiguration(language)

  await useOAuthClient()
  await oAuthClient.value?.getUserInfo()

  try {
    await oAuthClient.value?.signInSilently({})
  } catch (e) {
    console.error('Failed to sign in silently')
  }

  if (oAuthClient.value?.getAccessToken()) {
    user.value = await oAuthClient.value?.getUser()
  }
})
</script>

<style>
@media print {
  @page {
    size: auto;
    margin: 0mm;
  }
  .no-print,
  .no-print * {
    display: none !important;
  }
  #invoice {
    border: none;
  }
}
#invoice {
  border: 1px solid grey;
}
</style>
