<template>
  <div class="row justify-center no-print q-mb-md q-gutter-x-sm">
    <q-btn
      v-if="
        invoice &&
        [InvoiceStatus.OPEN, InvoiceStatus.BILL].includes(invoice.status) &&
        invoice.amountPaid
          ? invoice.amountPaid < invoice.totalIncludingTax
          : true
      "
      icon="payment"
      :label="lang.payment.pay"
      color="primary"
    >
      <q-menu>
        <q-list>
          <q-item clickable @click="payWithIdeal">
            <q-item-section avatar>
              <q-icon name="fa-brands fa-ideal" />
            </q-item-section>
            <q-item-section>
              <q-item-label> iDEAL </q-item-label>
            </q-item-section>
          </q-item>
          <q-item clickable @click="openBankTransferDialog">
            <q-item-section avatar>
              <q-icon name="fa-solid fa-money-bill-transfer" />
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{ lang.payment.methods.bankTransfer }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
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

  <div v-if="invoice" class="column items-center">
    <div class="col">
      <div v-if="invoice.amountDue" class="text-center no-print">
        {{ lang.payment.amountDue }}:
        <price
          :model-value="invoice.amountDue"
          :currency="invoice.currency"
          :locale="invoice.locale"
        />
      </div>
      <invoice-page id="invoice" ref="invoiceRef" :model-value="invoice" />
    </div>
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
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLang, loadLang } from './../lang/index.js'
import { useMeta } from 'quasar'
import { InvoiceStatus } from '@slimfact/api/zod'
import { generateEpcQrCodeData } from '@slimfact/tools/epc-qr'
import { renderSVG } from 'uqr'
import { ResponsiveDialog } from '@simsustech/quasar-components'
import Price from '../components/Price.vue'

const { useQuery, useMutation } = await createUseTrpc()
const lang = useLang()
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

const bankTransferDialogRef = ref<typeof ResponsiveDialog>()
const openBankTransferDialog = () => {
  bankTransferDialogRef.value?.functions.open()
}

const print = () => {
  if (!import.meta.env.SSR) {
    window.print()
  }
}
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
