<template>
  <q-page padding>
    <q-banner
      v-if="bankingDisabled"
      class="bg-amber-1 text-amber-9 q-mb-md"
      inline-actions
    >
      {{ lang.bank.notConfigured }}
      <template #action>
        <q-btn
          flat
          :label="lang.bank.pages.settings"
          icon="i-mdi-cog"
          to="/admin/settings/banking"
        />
      </template>
    </q-banner>

    <template v-if="!bankingDisabled">
      <div class="row q-mb-sm items-center">
        <q-select
          v-model="linkedFilter"
          :options="linkedOptions"
          :label="lang.bank.columns.linked"
          emit-value
          map-options
          dense
          outlined
          class="q-mr-sm"
          style="min-width: 160px"
        />
        <!-- Empty selection = all companies (no select-all prefill needed). -->
        <q-select
          v-model="companyFilter"
          :options="companyOptions"
          :label="lang.bank.companyFilter"
          :placeholder="lang.bank.allCompanies"
          multiple
          clearable
          dense
          outlined
          emit-value
          map-options
          class="q-mr-sm"
          style="min-width: 240px"
        />
        <q-toggle
          v-model="suggestionsOnly"
          :label="lang.bank.onlySuggestions"
          dense
        />
        <q-btn
          :label="lang.bank.actions.refresh"
          icon="i-mdi-refresh"
          flat
          dense
          @click="refreshTransactions"
        />
      </div>

      <div class="row q-mb-sm items-center">
        <date-input
          v-model="fromDate"
          :label="lang.bank.fromDate"
          :icons="{ event: 'i-mdi-calendar', clear: 'i-mdi-close' }"
          clearable
          class="q-mr-sm"
          style="min-width: 150px"
        />
        <date-input
          v-model="toDate"
          :label="lang.bank.toDate"
          :icons="{ event: 'i-mdi-calendar', clear: 'i-mdi-close' }"
          clearable
          class="q-mr-sm"
          style="min-width: 150px"
        />
      </div>

      <q-table
        :rows="rows ?? []"
        :columns="transactionColumns"
        row-key="transaction.externalId"
        flat
        bordered
        :loading="loading"
        :pagination="{
          rowsPerPage: 25,
          sortBy: 'transaction.bookingDate',
          descending: true
        }"
        :rows-per-page-options="[10, 25, 50, 100]"
      >
        <template #body-cell-amountCents="props">
          <q-td :props="props">
            <span
              :class="
                props.row.transaction.creditDebit === 'CRDT'
                  ? 'text-positive'
                  : 'text-negative'
              "
            >
              {{ formatAmount(props.row.transaction) }}
            </span>
          </q-td>
        </template>
        <template #body-cell-coverage="props">
          <q-td :props="props">
            <q-chip
              :label="coverageLabel(props.row.coverage)"
              :color="coverageColor(props.row.coverage)"
              text-color="white"
              size="sm"
            />
          </q-td>
        </template>
        <template #body-cell-match="props">
          <q-td :props="props">
            <q-chip
              v-if="props.row.linkedInvoices?.length > 0"
              dense
              color="positive"
              text-color="white"
              icon="i-mdi-link"
            >
              {{ lang.bank.linked }}:
              {{ props.row.linkedInvoices.map((i) => i.number).join(' · ') }}
            </q-chip>
            <q-chip
              v-else-if="props.row.suggestion"
              dense
              outline
              color="amber-9"
              icon="i-mdi-lightbulb"
            >
              {{ lang.bank.suggested }}:
              {{ suggestionHint(props.row.suggestion) }}
            </q-chip>
            <div
              v-if="partialCoverageHint(props.row)"
              class="text-caption text-grey-7"
            >
              {{ partialCoverageHint(props.row) }}
            </div>
          </q-td>
        </template>
        <template #body-cell-company="props">
          <q-td :props="props">
            {{ props.row.companyName ?? props.row.account.aspspName }}
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              v-if="props.row.coverage === 'settled' && props.row.psp"
              icon="i-mdi-invoice-text"
              flat
              :title="lang.bank.settlementDetails"
              :aria-label="lang.bank.settlementDetails"
              data-testid="bank-settlement-details"
              @click="openDialog(props.row)"
            />
            <q-btn
              v-else-if="props.row.linkedInvoices.length > 0"
              icon="i-mdi-eye"
              flat
              :title="lang.bank.actions.viewLinked"
              :aria-label="lang.bank.actions.viewLinked"
              data-testid="bank-view-linked"
              :to="viewHref(props.row)"
            />
            <q-btn
              v-if="canLink(props.row)"
              icon="i-mdi-link"
              color="primary"
              :title="lang.bank.actions.linkTransaction"
              :aria-label="lang.bank.actions.linkTransaction"
              data-testid="bank-link"
              @click="openDialog(props.row)"
            />
          </q-td>
        </template>
        <template #no-data>
          <div class="q-pa-md text-center text-grey-6">
            {{ lang.bank.empty }}
          </div>
        </template>
      </q-table>

      <bank-link-dialog
        ref="linkDialogRef"
        :row="dialogRow"
        @linked="refreshTransactions"
      />
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { DateInput } from '@simsustech/quasar-components/form'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLang } from '../../../lang/index.js'
import { useAdminGetCompaniesQuery } from '../../../queries/admin/companies.js'
import {
  useAdminListBankTransactionsQuery,
  type Coverage,
  type LinkProposal,
  type OverviewRow
} from '../../../queries/admin/bankTransactions.js'
import { formatMoney } from '../../../utils/money.js'
import BankLinkDialog from './BankLinkDialog.vue'
const lang = useLang()

const linkedFilter = ref<'all' | 'linked' | 'unlinked' | 'settled'>('all')
const linkedOptions = [
  { label: lang.value.bank.allLinked, value: 'all' },
  { label: lang.value.bank.linked, value: 'linked' },
  { label: lang.value.bank.unlinked, value: 'unlinked' },
  { label: lang.value.bank.coverage.settled, value: 'settled' }
]
const companyFilter = ref<number[]>([])
const suggestionsOnly = ref(false)
const fromDate = ref<string | null>(null)
const toDate = ref<string | null>(null)

const companiesQuery = useAdminGetCompaniesQuery()
const companyOptions = computed(() =>
  (companiesQuery.companies.value ?? []).map((company) => ({
    label: company.name,
    value: company.id
  }))
)

const linkedRef = computed(() =>
  linkedFilter.value === 'all' ? undefined : linkedFilter.value
)
const fromRef = computed(() => fromDate.value || undefined)
const toRef = computed(() => toDate.value || undefined)

const transactionsQuery = useAdminListBankTransactionsQuery(
  companyFilter,
  linkedRef,
  suggestionsOnly,
  fromRef,
  toRef
)
const loading = computed(() => transactionsQuery.status.value === 'pending')
const rows = computed(() => transactionsQuery.payload.value?.items ?? [])
// Only an explicit `enabled === false` means not configured; while loading the
// payload is undefined and we simply render nothing yet.
const bankingDisabled = computed(
  () => transactionsQuery.payload.value?.enabled === false
)

const refreshTransactions = async () => {
  await transactionsQuery.refresh()
}

// --- URL query sync -------------------------------------------------------
// Persist the filter state in the route query so a reload or shared link
// restores it. Restore happens client-side only (onMounted), so SSR renders
// the defaults.
const route = useRoute()
const router = useRouter()

onMounted(() => {
  const query = route.query
  const linked = typeof query.linked === 'string' ? query.linked : null
  if (linked === 'linked' || linked === 'unlinked' || linked === 'settled') {
    linkedFilter.value = linked
  }
  if (typeof query.companies === 'string') {
    companyFilter.value = query.companies
      .split(',')
      .map(Number)
      .filter((id) => Number.isInteger(id))
  }
  if (query.suggestions === '1') suggestionsOnly.value = true
  if (typeof query.from === 'string' && query.from !== '')
    fromDate.value = query.from
  if (typeof query.to === 'string' && query.to !== '') toDate.value = query.to
})

watch(
  [linkedFilter, companyFilter, suggestionsOnly, fromDate, toDate],
  () => {
    const query: Record<string, string> = {}
    if (linkedFilter.value !== 'all') query.linked = linkedFilter.value
    if (companyFilter.value.length > 0)
      query.companies = companyFilter.value.join(',')
    if (suggestionsOnly.value) query.suggestions = '1'
    if (fromDate.value) query.from = fromDate.value
    if (toDate.value) query.to = toDate.value
    void router.replace({ query })
  },
  { deep: true }
)

const linkDialogRef = ref<InstanceType<typeof BankLinkDialog>>()
const dialogRow = ref<OverviewRow | null>(null)
const openDialog = (row: OverviewRow) => {
  dialogRow.value = row
  linkDialogRef.value?.functions.open()
}

const viewHref = (row: OverviewRow): string =>
  '/admin/invoices/' + row.linkedInvoices.map((i) => i.uuid).join('/')

/** A row is linkable while a suggestion exists or it is only partially linked. */
// A settled PSP payout is read-only (no re-linking); expose the settlement
// details (view button) instead.
const canLink = (row: OverviewRow): boolean =>
  row.coverage !== 'full' && row.coverage !== 'settled'

const coverageLabel = (coverage: Coverage): string =>
  lang.value.bank.coverage[coverage]

const coverageColor = (coverage: Coverage): string => {
  switch (coverage) {
    case 'full':
      return 'positive'
    case 'partial':
      return 'amber-8'
    case 'settled':
      return 'info'
    default:
      return 'grey-6'
  }
}

const suggestionHint = (suggestion: LinkProposal): string => {
  switch (suggestion.type) {
    case 'single':
      return suggestion.invoice.number ?? ''
    case 'multi':
      return lang.value.bank.suggestionMulti.replace(
        '{count}',
        String(suggestion.invoices.length)
      )
    case 'split':
      return suggestion.invoice.number ?? ''
  }
}

/**
 * For partially-linked transactions show how much of the transaction is
 * already linked. The overview payload carries no per-link amounts, so the
 * linked portion is only shown when a split proposal makes it derivable;
 * otherwise just the transaction total.
 */
const partialCoverageHint = (row: OverviewRow): string | null => {
  if (row.coverage !== 'partial') return null
  if (row.suggestion?.type !== 'split') return null
  const totalCents = row.transaction.amountCents
  const linkedCents = Math.min(row.suggestion.partialAmountCents, totalCents)
  return lang.value.bank.partialCoverageLinked
    .replace('{linked}', formatMoney(linkedCents, row.transaction.currency))
    .replace('{total}', formatMoney(totalCents, row.transaction.currency))
}

const transactionColumns = [
  {
    name: 'bookingDate',
    required: true,
    label: lang.value.bank.columns.date,
    align: 'left' as const,
    field: (row: OverviewRow) => row.transaction.bookingDate
  },
  {
    name: 'amountCents',
    required: true,
    label: lang.value.bank.columns.amount,
    align: 'right' as const,
    field: (row: OverviewRow) => row.transaction.amountCents
  },
  {
    name: 'counterpartyName',
    label: lang.value.bank.columns.counterparty,
    align: 'left' as const,
    field: (row: OverviewRow) => row.transaction.counterpartyName
  },
  {
    name: 'description',
    label: lang.value.bank.columns.description,
    align: 'left' as const,
    field: (row: OverviewRow) => row.transaction.description
  },
  {
    name: 'coverage',
    label: lang.value.bank.columns.linked,
    align: 'left' as const,
    field: (row: OverviewRow) => row.coverage
  },
  {
    name: 'match',
    label: lang.value.bank.columns.match,
    align: 'left' as const,
    field: (row: OverviewRow) =>
      row.linkedInvoices.length > 0
        ? row.linkedInvoices.map((i) => i.number).join(' · ')
        : row.suggestion
          ? suggestionHint(row.suggestion)
          : null
  },
  {
    name: 'company',
    label: lang.value.bank.columns.company,
    align: 'left' as const,
    field: (row: OverviewRow) => row.companyName
  },
  {
    name: 'actions',
    label: '',
    align: 'right' as const
  }
]

const formatAmount = (tx: {
  amountCents: number
  currency: string
  creditDebit: string
}) =>
  `${tx.creditDebit === 'CRDT' ? '+' : '-'}${formatMoney(
    tx.amountCents,
    tx.currency
  )}`
</script>
