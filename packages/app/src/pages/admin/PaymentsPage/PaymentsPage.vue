<template>
  <q-page padding>
    <!-- Aggregates header -->
    <div class="row q-mb-md q-gutter-sm">
      <q-card class="q-pa-sm col-2 min-card">
        <q-card-section class="q-pa-xs">
          <div class="text-caption text-grey-7">
            {{ lang.payment.overview.in }}
          </div>
          <div class="text-h6 text-positive" data-testid="agg-in">
            {{ formatMoney(aggregates?.inCents ?? 0) }}
          </div>
        </q-card-section>
      </q-card>
      <q-card class="q-pa-sm col-2 min-card">
        <q-card-section class="q-pa-xs">
          <div class="text-caption text-grey-7">
            {{ lang.payment.overview.refunded }}
          </div>
          <div class="text-h6 text-negative" data-testid="agg-refunded">
            {{ formatMoney(aggregates?.refundedCents ?? 0) }}
          </div>
        </q-card-section>
      </q-card>
      <q-card class="q-pa-sm col-2 min-card">
        <q-card-section class="q-pa-xs">
          <div class="text-caption text-grey-7">
            {{ lang.payment.overview.net }}
          </div>
          <div class="text-h6" data-testid="agg-net">
            {{ formatMoney(aggregates?.netCents ?? 0) }}
          </div>
        </q-card-section>
      </q-card>
      <q-card class="q-pa-sm col-2 min-card">
        <q-card-section class="q-pa-xs">
          <div class="text-caption text-grey-7">
            {{ lang.payment.overview.count }}
          </div>
          <div class="text-h6">{{ payload?.total ?? 0 }}</div>
        </q-card-section>
      </q-card>
      <q-card
        v-if="(aggregates?.unallocatedCents ?? 0) > 0"
        class="q-pa-sm col-2 min-card"
      >
        <q-card-section class="q-pa-xs">
          <div class="text-caption text-grey-7">
            {{ lang.payment.overview.unallocated }}
          </div>
          <div class="text-h6 text-amber-9" data-testid="agg-unallocated">
            {{ formatMoney(aggregates?.unallocatedCents ?? 0) }}
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Filters -->
    <div class="row q-mb-sm items-center q-gutter-sm">
      <q-input
        v-model="search"
        :label="lang.payment.overview.search"
        dense
        outlined
        clearable
        style="min-width: 220px"
      />
      <date-input
        v-model="fromDate"
        :label="lang.payment.overview.fromDate"
        :icons="{ event: 'i-mdi-calendar', clear: 'i-mdi-close' }"
        clearable
        style="min-width: 150px"
      />
      <date-input
        v-model="toDate"
        :label="lang.payment.overview.toDate"
        :icons="{ event: 'i-mdi-calendar', clear: 'i-mdi-close' }"
        clearable
        style="min-width: 150px"
      />
      <q-select
        v-model="filters.methods"
        :options="methodOptions"
        :label="lang.payment.overview.methods"
        multiple
        dense
        outlined
        emit-value
        map-options
        style="min-width: 170px"
      />
      <q-select
        v-model="filters.statuses"
        :options="statusOptions"
        :label="lang.payment.overview.statuses"
        multiple
        dense
        outlined
        style="min-width: 150px"
      />
      <q-select
        v-model="filters.psps"
        :options="pspOptions"
        :label="lang.payment.overview.psps"
        multiple
        dense
        outlined
        style="min-width: 130px"
      />
      <q-select
        v-model="filters.sources"
        :options="sourceOptions"
        :label="lang.payment.overview.source"
        multiple
        dense
        outlined
        emit-value
        map-options
        style="min-width: 170px"
      />
      <q-btn
        flat
        dense
        icon="i-mdi-refresh"
        :label="lang.payment.overview.refresh"
        @click="refresh"
      />
      <q-btn
        flat
        dense
        icon="i-mdi-download"
        :label="lang.payment.overview.export"
        data-testid="ledger-export"
        @click="exportCsv"
      />
    </div>

    <q-banner v-if="truncated" class="bg-amber-1 text-amber-9 q-mb-sm">
      {{ lang.payment.overview.truncated }}
    </q-banner>

    <q-table
      :rows="rows"
      :columns="columns"
      row-key="rowKey"
      flat
      bordered
      :loading="loading"
      :pagination="{ rowsPerPage: 50 }"
      :rows-per-page-options="[10, 25, 50, 100]"
    >
      <template #body-cell-method="props">
        <q-td :props="props">
          <q-chip dense outline color="grey-8" size="sm">
            {{ methodLabel(props.row.method) }}
          </q-chip>
          <q-badge
            v-if="props.row.bankSynced"
            data-testid="ledger-bank-synced"
            color="blue-grey-6"
            :label="lang.payment.overview.viaBankSync"
          />
        </q-td>
      </template>
      <template #body-cell-invoiceNumber="props">
        <q-td :props="props">
          <router-link
            v-if="props.row.invoiceUuid"
            :to="`/admin/invoices?uuid=${props.row.invoiceUuid}`"
            data-testid="ledger-invoice-link"
          >
            {{ props.row.invoiceNumber }}
          </router-link>
        </q-td>
      </template>
      <template #body-cell-clientName="props">
        <q-td :props="props">
          {{
            props.row.clientName ??
            (props.row.kind === 'bank' ? props.row.bankCompanyName : null)
          }}
        </q-td>
      </template>
      <template #body-cell-amountCents="props">
        <q-td :props="props">
          <span
            :class="
              props.row.amountCents < 0 ? 'text-negative' : 'text-positive'
            "
          >
            {{ formatMoney(props.row.amountCents, props.row.currency) }}
          </span>
        </q-td>
      </template>
      <template #body-cell-status="props">
        <q-td :props="props">
          <q-badge
            v-if="props.row.status === 'needsReview'"
            data-testid="ledger-needs-review"
            color="amber-9"
            :label="lang.payment.overview.needsReview"
          />
          <span v-else>{{ props.row.status }}</span>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            v-if="props.row.kind === 'bank'"
            icon="i-mdi-link"
            color="primary"
            flat
            dense
            :title="lang.bank.actions.linkTransaction"
            :aria-label="lang.bank.actions.linkTransaction"
            data-testid="ledger-link"
            @click="openLinkDialog(props.row)"
          />
          <q-btn
            v-else-if="isDeletable(props.row)"
            icon="i-mdi-delete"
            color="negative"
            flat
            dense
            :title="lang.payment.overview.deletePayment"
            :aria-label="lang.payment.overview.deletePayment"
            data-testid="ledger-delete"
            @click="openDeleteDialog(props.row)"
          />
        </q-td>
      </template>
      <template #no-data>
        <div class="q-pa-md text-center text-grey-6">
          {{ lang.payment.overview.empty }}
        </div>
      </template>
    </q-table>

    <bank-link-dialog ref="linkDialogRef" :row="dialogRow" @linked="refresh" />
  </q-page>
</template>

<script setup lang="ts">
import { DateInput } from '@simsustech/quasar-components/form'
import type { PaymentMethod } from '@modular-api/fastify-checkout'
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useLang } from '../../../lang/index.js'
import { formatMoney } from '../../../utils/money.js'
import {
  useAdminGetPaymentsQuery,
  usePaymentsUrlState,
  type PaymentsLedgerRow
} from '../../../queries/admin/payments.js'
import { useAdminDeletePaymentFromInvoiceMutation } from '../../../queries/admin/invoices.js'
import { useAdminExportPaymentsMutation } from '../../../queries/admin/payments.js'
import type { OverviewRow } from '../../../queries/admin/bankTransactions.js'
import BankLinkDialog from '../BankPage/BankLinkDialog.vue'

const lang = useLang()
const $q = useQuasar()

const { filters, search } = usePaymentsUrlState()
const page = ref({ limit: 50, offset: 0 })

const fromDate = computed({
  get: () => filters.value.from ?? null,
  set: (value: string | null) => {
    filters.value = { ...filters.value, from: value || undefined }
  }
})
const toDate = computed({
  get: () => filters.value.to ?? null,
  set: (value: string | null) => {
    filters.value = { ...filters.value, to: value || undefined }
  }
})

const paymentsQuery = useAdminGetPaymentsQuery(filters, page)
const payload = paymentsQuery.payload
const loading = computed(() => paymentsQuery.status.value === 'pending')
const rows = computed(() => paymentsQuery.payload.value?.rows ?? [])
const aggregates = computed(() => paymentsQuery.payload.value?.aggregates)
const truncated = computed(() => false)

const { mutateAsync: exportPaymentsMutation } = useAdminExportPaymentsMutation()

const CSV_ESCAPE = (value: string): string =>
  /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

const exportCsv = async () => {
  const value = filters.value
  const result = await exportPaymentsMutation({
    ...(value.q ? { q: value.q } : {}),
    ...(value.from ? { from: value.from } : {}),
    ...(value.to ? { to: value.to } : {}),
    ...(value.methods.length ? { methods: value.methods } : {}),
    ...(value.statuses.length ? { statuses: value.statuses } : {}),
    ...(value.psps.length ? { psps: value.psps } : {}),
    ...(value.sources.length ? { sources: value.sources } : {})
  })
  if (result.truncated) {
    $q.notify({
      type: 'warning',
      message: lang.value.payment.overview.truncated
    })
  }
  const header = [
    lang.value.payment.overview.columns.date,
    lang.value.payment.overview.columns.method,
    lang.value.payment.overview.columns.description,
    lang.value.payment.overview.columns.invoice,
    lang.value.payment.overview.columns.client,
    lang.value.payment.overview.columns.amount,
    lang.value.payment.overview.columns.status,
    lang.value.payment.overview.columns.psp
  ].join(';')
  const lines = result.rows.map((row) =>
    [
      row.date,
      methodLabel(row.method),
      row.description,
      row.invoiceNumber ?? '',
      row.clientName ?? '',
      (row.amountCents / 100).toFixed(2),
      row.currency,
      row.status,
      row.psp ?? '',
      row.transactionReference ?? ''
    ]
      .map(CSV_ESCAPE)
      .join(';')
  )
  const blob = new Blob([`\uFEFF${[header, ...lines].join('\r\n')}`], {
    type: 'text/csv;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `slimfact-payments-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  anchor.click()
  // Defer revocation: revoking synchronously can cancel the pending save.
  setTimeout(() => URL.revokeObjectURL(url), 5_000)
}

const refresh = async () => {
  await paymentsQuery.refresh()
}

// --- Options ---------------------------------------------------------------

// Wire values derived from the lang keys (camelCase → lowercase); keeps the
// fastify-checkout module out of the client bundle.
const methodLabel = (method: string): string =>
  (lang.value.payment.methods as Record<string, string | undefined>)[method] ??
  method

const methodOptions = Object.keys(lang.value.payment.methods).map((key) => {
  const value = key.charAt(0).toLowerCase() + key.slice(1)
  return { label: methodLabel(value), value }
})
const statusOptions = [
  'open',
  'pending',
  'authorized',
  'paid',
  'canceled',
  'expired',
  'failed'
]
const pspOptions = ['mollie', 'stripe']
const sourceOptions = [
  {
    label: lang.value.payment.overview.sources.payments,
    value: 'payments' as const
  },
  {
    label: lang.value.payment.overview.sources.refunds,
    value: 'refunds' as const
  },
  {
    label: lang.value.payment.overview.sources.bankReview,
    value: 'bank' as const
  }
]

// --- Table -----------------------------------------------------------------

const columns = [
  {
    name: 'date',
    label: lang.value.payment.overview.columns.date,
    field: 'date',
    align: 'left' as const,
    sortable: true
  },
  {
    name: 'method',
    label: lang.value.payment.overview.columns.method,
    field: 'method',
    align: 'left' as const
  },
  {
    name: 'description',
    label: lang.value.payment.overview.columns.description,
    field: 'description',
    align: 'left' as const
  },
  {
    name: 'invoiceNumber',
    label: lang.value.payment.overview.columns.invoice,
    field: 'invoiceNumber',
    align: 'left' as const
  },
  {
    name: 'clientName',
    label: lang.value.payment.overview.columns.client,
    field: 'clientName',
    align: 'left' as const
  },
  {
    name: 'amountCents',
    label: lang.value.payment.overview.columns.amount,
    field: 'amountCents',
    align: 'right' as const
  },
  {
    name: 'status',
    label: lang.value.payment.overview.columns.status,
    field: 'status',
    align: 'left' as const
  },
  {
    name: 'psp',
    label: lang.value.payment.overview.columns.psp,
    field: 'psp',
    align: 'left' as const
  },
  { name: 'actions', label: '', field: 'actions' }
]

const rowKey = (row: PaymentsLedgerRow): string =>
  `${row.kind}-${row.id ?? row.transactionReference ?? row.date}`
void rowKey

// --- Link dialog (bank review rows) ----------------------------------------

const linkDialogRef = ref()
const dialogRow = ref<OverviewRow | null>(null)

const openLinkDialog = (row: PaymentsLedgerRow) => {
  // Synthesize the overview row shape the reused dialog expects; company and
  // account data were resolved server-side on the ledger row.
  dialogRow.value = {
    transaction: {
      externalId: (row.transactionReference ?? '').slice('bank:'.length),
      accountExternalId: row.bankAccountExternalId ?? '',
      companyId: row.bankCompanyIds?.[0] ?? 0,
      amountCents: row.amountCents,
      currency: row.currency,
      creditDebit: 'CRDT',
      status: 'BOOK',
      bookingDate: row.date.slice(0, 10),
      description: null,
      remittanceInformation: row.description,
      referenceNumber: null,
      counterpartyName: row.description,
      counterpartyIban: null
    },
    account: {
      id: row.bankAccountExternalId ?? '',
      aspspName: row.bankCompanyName ?? '',
      aspspCountry: 'NL',
      currency: row.currency,
      iban: row.bankIban ?? null,
      needsReconnect: false
    },
    companyId: row.bankCompanyIds?.[0] ?? null,
    companyName: row.bankCompanyName ?? null,
    coverage: 'unlinked',
    linkedInvoices: [],
    suggestion: null,
    psp: null
  }
  linkDialogRef.value?.functions.open()
}

// --- Offline payment deletion (rules unchanged) -----------------------------

const { mutateAsync: deletePaymentFromInvoiceMutation } =
  useAdminDeletePaymentFromInvoiceMutation()

const OFFLINE_METHODS = new Set<string>(['cash', 'pin', 'banktransfer'])

const isDeletable = (row: PaymentsLedgerRow): boolean =>
  row.kind === 'payment' && !row.bankSynced && OFFLINE_METHODS.has(row.method)

const openDeleteDialog = async (data: PaymentsLedgerRow) => {
  const methodLabels: Record<string, string> = {
    cash: lang.value.payment.methods.cash,
    banktransfer: lang.value.payment.methods.bankTransfer,
    pin: lang.value.payment.methods.pin
  }
  const formattedAmount = Intl.NumberFormat($q.lang.isoName, {
    maximumFractionDigits: 2,
    style: 'currency',
    currency: data.currency ?? 'EUR'
  }).format((data.amountCents ?? 0) / 100)
  $q.dialog({
    message: lang.value.payment.confirmDeletePayment({
      method: methodLabels[data.method] ?? data.method,
      number: data.invoiceNumber ?? '',
      amount: formattedAmount
    }),
    cancel: true
  }).onOk(async () => {
    if (data.invoiceId == null) return
    try {
      await deletePaymentFromInvoiceMutation({
        id: data.invoiceId,
        paymentId: data.id as number
      })
      await refresh()
    } catch {}
  })
}
</script>
