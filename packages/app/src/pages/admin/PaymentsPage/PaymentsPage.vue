<template>
  <q-page padding>
    <q-tabs v-model="activeTab" align="left" class="q-mb-md">
      <q-tab name="payments" :label="lang.payment.overview.tabs.payments" />
      <q-tab
        name="suggestions"
        :label="lang.payment.overview.tabs.suggestions"
      />
    </q-tabs>

    <q-tab-panels v-model="activeTab" animated>
      <!-- Payments panel -->
      <q-tab-panel name="payments" class="q-pa-none">
        <!-- Aggregates header -->
        <q-card class="q-pa-sm q-mb-md" style="max-width: 560px">
          <q-card-section class="q-pa-xs row q-gutter-md">
            <div>
              <div class="text-caption text-grey-7">
                {{ lang.payment.overview.in }}
              </div>
              <div class="text-h6 text-positive" data-testid="agg-in">
                {{ formatMoney(aggregates?.inCents ?? 0) }}
              </div>
            </div>
            <div>
              <div class="text-caption text-grey-7">
                {{ lang.payment.overview.refunded }}
              </div>
              <div class="text-h6 text-negative" data-testid="agg-refunded">
                {{ formatMoney(aggregates?.refundedCents ?? 0) }}
              </div>
            </div>
            <div>
              <div class="text-caption text-grey-7">
                {{ lang.payment.overview.net }}
              </div>
              <div class="text-h6" data-testid="agg-net">
                {{ formatMoney(aggregates?.netCents ?? 0) }}
              </div>
            </div>
          </q-card-section>
        </q-card>
        <div v-if="filterSummary" class="text-caption text-grey-6 q-mb-md">
          {{ filterSummary }}
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
          :row-key="rowKey"
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
              {{ props.row.clientName }}
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
              <span>{{ props.row.status }}</span>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                v-if="isDeletable(props.row)"
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
      </q-tab-panel>

      <!-- Suggestions tab: actionable unlinked bank credits -->
      <q-tab-panel name="suggestions" class="q-pa-none">
        <q-table
          :rows="suggestionItems"
          :columns="suggestionColumns"
          :row-key="(row) => row.transaction.externalId"
          flat
          bordered
          :loading="suggestionsLoading"
          :pagination="{ rowsPerPage: 50 }"
          :rows-per-page-options="[10, 25, 50, 100]"
        >
          <template #body-cell-date="props">
            <q-td :props="props">
              {{
                props.row.transaction.bookingDate ??
                props.row.transaction.transactionDate
              }}
            </q-td>
          </template>
          <template #body-cell-amount="props">
            <q-td :props="props">
              <span class="text-positive">
                {{
                  formatMoney(
                    props.row.transaction.amountCents,
                    props.row.transaction.currency
                  )
                }}
              </span>
            </q-td>
          </template>
          <template #body-cell-payer="props">
            <q-td :props="props">
              {{ props.row.transaction.counterpartyName }}
            </q-td>
          </template>
          <template #body-cell-description="props">
            <q-td :props="props">
              {{
                props.row.transaction.description ??
                props.row.transaction.remittanceInformation
              }}
            </q-td>
          </template>
          <template #body-cell-suggestion="props">
            <q-td :props="props">
              <q-chip
                v-if="props.row.topSuggestion"
                color="primary"
                text-color="white"
                size="sm"
                data-testid="suggestion-chip"
              >
                {{
                  props.row.topSuggestion.invoiceNumber ||
                  lang.payment.suggestions.topSuggestion
                }}
              </q-chip>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                v-if="props.row.topSuggestion"
                color="primary"
                flat
                dense
                icon="i-mdi-link"
                :title="lang.payment.suggestions.link"
                :aria-label="lang.payment.suggestions.link"
                data-testid="suggestion-link"
                @click="openSuggestionLinkDialog(props.row)"
              />
            </q-td>
          </template>
          <template #no-data>
            <div class="q-pa-md text-center text-grey-6">
              {{ lang.payment.suggestions.empty }}
            </div>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>

    <bank-link-dialog ref="linkDialogRef" :row="linkRow" @linked="onLinked" />
  </q-page>
</template>

<script setup lang="ts">
import { DateInput } from '@simsustech/quasar-components/form'
import type { PaymentMethod } from '@modular-api/fastify-checkout'
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { useLang } from '../../../lang/index.js'
import { formatMoney } from '../../../utils/money.js'
import {
  useAdminGetPaymentsQuery,
  usePaymentsUrlState,
  type PaymentsLedgerRow
} from '../../../queries/admin/payments.js'
import { useAdminDeletePaymentFromInvoiceMutation } from '../../../queries/admin/invoices.js'
import { useAdminExportPaymentsMutation } from '../../../queries/admin/payments.js'
import { useAdminListSuggestionsQuery } from '../../../queries/admin/bankTransactions.ts'
import BankLinkDialog from '../BankPage/BankLinkDialog.vue'

const lang = useLang()
const $q = useQuasar()
const route = useRoute()
const router = useRouter()

// --- Tab state (?tab=payments|suggestions) ---
const validTabs = ['payments', 'suggestions'] as const
const activeTab = ref(
  validTabs.includes(route.query.tab as string)
    ? (route.query.tab as string)
    : 'payments'
)
watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
})

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
const truncated = computed(
  () => paymentsQuery.payload.value?.truncated ?? false
)

const { mutateAsync: exportPaymentsMutation } = useAdminExportPaymentsMutation()

const CSV_ESCAPE = (value: string): string =>
  /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

const exportCsv = async () => {
  const value = filters.value
  const result = await exportPaymentsMutation({
    ...(value.q ? { q: value.q } : {}),
    ...(value.from ? { from: value.from } : {}),
    ...(value.to ? { to: value.to } : {}),
    ...(value.methods.length ? { methods: value.methods as never } : {}),
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
  setTimeout(() => URL.revokeObjectURL(url), 5_000)
}

const refresh = async () => {
  await paymentsQuery.refresh()
}

// --- Options ---------------------------------------------------------------

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
  }
]

const filterSummary = computed(() => {
  const parts: string[] = []
  const f = filters.value
  if (f.from) parts.push(`From ${f.from}`)
  if (f.to) parts.push(`To ${f.to}`)
  if (f.q) parts.push(`"${f.q}"`)
  if (f.methods.length)
    parts.push(`Methods: ${f.methods.map((m) => methodLabel(m)).join(', ')}`)
  if (f.statuses.length) parts.push(`Statuses: ${f.statuses.join(', ')}`)
  if (f.psps.length) parts.push(`PSPs: ${f.psps.join(', ')}`)
  if (f.sources.length && f.sources.length < 2)
    parts.push(`Sources: ${f.sources.join(', ')}`)
  return parts.join(' · ')
})

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

// --- Offline payment deletion (rules unchanged) -----------------------------

const { mutateAsync: deletePaymentFromInvoiceMutation } =
  useAdminDeletePaymentFromInvoiceMutation()

const OFFLINE_METHODS = new Set<string>(['cash', 'pin', 'banktransfer'])

const isDeletable = (row: PaymentsLedgerRow): boolean =>
  row.kind === 'payment' && OFFLINE_METHODS.has(row.method)

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

// --- Suggestions tab -------------------------------------------------------

const suggestionsQuery = useAdminListSuggestionsQuery()
const suggestionItems = computed(
  () => suggestionsQuery.payload.value?.items ?? []
)
const suggestionsLoading = computed(
  () => suggestionsQuery.status.value === 'pending'
)

const suggestionColumns = [
  {
    name: 'date',
    label: lang.value.payment.overview.columns.date,
    field: 'date',
    align: 'left' as const
  },
  {
    name: 'amount',
    label: lang.value.payment.overview.columns.amount,
    field: 'amount',
    align: 'right' as const
  },
  {
    name: 'payer',
    label: 'Payer',
    field: 'payer',
    align: 'left' as const
  },
  {
    name: 'description',
    label: lang.value.payment.overview.columns.description,
    field: 'description',
    align: 'left' as const
  },
  {
    name: 'suggestion',
    label: lang.value.payment.suggestions?.topSuggestion ?? 'Suggestion',
    field: 'suggestion',
    align: 'left' as const
  },
  { name: 'actions', label: '', field: 'actions' }
]

const linkRow = ref<(typeof suggestionItems.value)[number] | null>(null)
const linkDialogRef = ref<InstanceType<typeof BankLinkDialog>>()

const openSuggestionLinkDialog = (
  row: (typeof suggestionItems.value)[number]
) => {
  linkRow.value = row
  linkDialogRef.value?.functions.open()
}

const onLinked = async () => {
  linkRow.value = null
  await suggestionsQuery.refresh()
  await paymentsQuery.refresh()
}
</script>
