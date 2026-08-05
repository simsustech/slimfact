<template>
  <q-page padding>
    <div class="grid gap-4">
      <h1 class="text-h4">
        {{ lang.dashboard.admin.title }}
      </h1>

      <div class="grid grid-cols-12 gap-4">
        <section
          v-if="showCompanyFilter"
          class="dashboard-company-filter col-span-12 lg:col-span-6"
        >
          <q-select
            v-model="selectedCompanyIds"
            :options="companyOptions"
            :label="lang.dashboard.admin.companyFilter.label"
            multiple
            use-chips
            emit-value
            map-options
            dense
            outlined
            class="w-full"
          />
        </section>

        <div
          v-if="(companies?.length ?? 0) > 0 && selectedCompanyIds.length === 0"
          class="col-span-12 py-6 text-center italic text-gray-600"
        >
          {{ lang.dashboard.admin.empty.noCompanySelected }}
        </div>

        <template v-else>
          <section class="col-span-12">
            <q-card>
              <q-card-section class="row items-center q-gutter-md">
                <div class="text-subtitle1">
                  {{ lang.dashboard.admin.revenue.title }}
                </div>
                <q-btn-toggle
                  :model-value="activePreset"
                  @update:model-value="onPresetChange"
                  :options="presetButtons"
                  no-caps
                  dense
                  unelevated
                />
                <div class="col-12 row q-gutter-md items-center">
                  <DateInput
                    v-model="customDateFrom"
                    :label="lang.dashboard.admin.revenue.startDate"
                    @update:model-value="onCustomDateChange"
                    :icons="{ event: 'i-mdi-calendar', clear: 'i-mdi-close' }"
                    :format="DATE_FORMAT"
                  />
                  <DateInput
                    v-model="customDateTo"
                    :label="lang.dashboard.admin.revenue.endDate"
                    @update:model-value="onCustomDateChange"
                    :icons="{
                      event: 'i-mdi-calendar-end',
                      clear: 'i-mdi-close'
                    }"
                    :format="DATE_FORMAT"
                  />
                </div>
              </q-card-section>
              <q-card-section>
                <DashboardRevenueCards
                  :revenue-invoices="revenueInvoices"
                  :revenue-bills="revenueBills"
                  :revenue-receipts="revenueReceipts"
                  :date-label="dateLabel"
                />
                <div class="q-mt-md">
                  <DashboardRevenueChart
                    :labels="revenueChartData.labels"
                    :datasets="revenueChartData.datasets"
                    :buckets="revenueBuckets"
                    :bin-label="revenueBinLabel"
                    @select="onBucketSelect"
                  />
                </div>
              </q-card-section>
            </q-card>
          </section>

          <section class="col-span-12 grid grid-cols-12 gap-4">
            <div class="col-span-12 md:col-span-6">
              <DashboardDebtors
                :invoices="debtorInvoices"
                :bills="debtorBills"
              />
            </div>
            <div class="col-span-12 md:col-span-6">
              <DashboardActionItems
                :items="actionItems"
                @navigate="onNavigate"
              />
            </div>
          </section>

          <section class="col-span-12 grid grid-cols-12 gap-4">
            <div class="col-span-12 md:col-span-6">
              <DashboardUpcomingIncome
                :count="upcomingIncome?.count ?? 0"
                :total-amount="upcomingIncome?.totalAmount ?? 0"
                :next="upcomingIncome?.next ?? []"
              />
            </div>
            <div class="col-span-12 md:col-span-6">
              <DashboardPaymentMethods :rows="paymentMethodSplit ?? []" />
            </div>
          </section>

          <section class="col-span-12">
            <DashboardRecentActivity :entries="activityEntries" />
          </section>
        </template>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface DashboardStatsResponse {
  paidRevenueSeries: {
    labels: string[]
    buckets: { start: string; end: string }[]
    series: { status: InvoiceStatus; data: number[] }[]
  }
  outstandingTotal: number
  granularity: 'day' | 'week' | 'month' | 'quarter'
  statusCounts: {
    status: InvoiceStatus
    count: number
    totalAmount: number
  }[]
  overdueAging: {
    reminderCount: number
    count: number
    totalAmount: number
  }[]
  upcomingIncome: {
    count: number
    totalAmount: number
    next: {
      documentUuid: string
      documentNumber: string | null
      clientName: string | null
      amount: number
      dueDate: string | null
    }[]
  }
  paymentMethodSplit: {
    method: string
    totalAmount: number
    count: number
  }[]
}
import { useRouter } from 'vue-router'
import DashboardRevenueCards from '../../components/dashboard/DashboardRevenueCards.vue'
import DashboardRevenueChart from '../../components/dashboard/DashboardRevenueChart.vue'
import DashboardDebtors from '../../components/dashboard/DashboardDebtors.vue'
import DashboardUpcomingIncome from '../../components/dashboard/DashboardUpcomingIncome.vue'
import DashboardPaymentMethods from '../../components/dashboard/DashboardPaymentMethods.vue'
import DashboardActionItems, {
  type ActionItemsProps
} from '../../components/dashboard/DashboardActionItems.vue'
import DashboardRecentActivity, {
  type ActivityEntry
} from '../../components/dashboard/DashboardRecentActivity.vue'
import { useAdminGetCompaniesQuery } from '../../queries/admin/companies.js'
import {
  useAdminGetDashboardActivityQuery,
  useAdminGetDashboardStatsQuery,
  type ActivityEventType
} from '../../queries/admin/dashboard.js'
import { InvoiceStatus } from '@modular-api/fastify-checkout/types'
import { useLang } from '../../lang/index.js'
import { agingLabelForReminderCount } from '../../dashboard/aging.js'
import { DateInput } from '@simsustech/quasar-components/form'
import { configuration } from '../../configuration.js'

const DATE_FORMAT = computed(
  () => configuration.value.DATE_FORMAT || 'DD-MM-YYYY'
)
const lang = useLang()
const router = useRouter()

const { companies } = useAdminGetCompaniesQuery()

const selectedCompanyIds = ref<number[]>([])

watch(
  () => companies.value,
  (newCompanies) => {
    if (!newCompanies) return
    const list = newCompanies as { id: number }[]
    selectedCompanyIds.value = list.map((c) => c.id)
  },
  { immediate: true }
)

const showCompanyFilter = computed(() => (companies.value?.length ?? 0) > 1)

const companyOptions = computed(() =>
  ((companies.value ?? []) as { id: number; name: string }[]).map((c) => ({
    label: c.name,
    value: c.id
  }))
)
import { presetDateRange } from '../../components/dashboard/dateRange.js'
import {
  topBillsFromStatusCounts,
  topDebtorsFromStatusCounts
} from '../../components/dashboard/topDebtors.js'
import { aggregateActionItems } from '../../components/dashboard/actionItems.js'

type Preset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

const activePreset = ref<Preset>('month')
// Initialize the date inputs with the default (month) preset range so they
// are filled on first render instead of showing empty placeholders.
const initialRange = presetDateRange('month')
const customDateFrom = ref<string>(initialRange.dateFrom)
const customDateTo = ref<string>(initialRange.dateTo)

const presetButtons = computed(() => [
  { label: lang.value.dashboard.admin.revenue.today, value: 'today' },
  { label: lang.value.dashboard.admin.revenue.week, value: 'week' },
  { label: lang.value.dashboard.admin.revenue.month, value: 'month' },
  { label: lang.value.dashboard.admin.revenue.quarter, value: 'quarter' },
  { label: lang.value.dashboard.admin.revenue.year, value: 'year' }
])

// Selecting a preset populates the start/end date inputs with its range so
// the user always sees which period the dashboard covers.
const onPresetChange = (preset: Preset) => {
  if (preset === 'custom') return
  activePreset.value = preset
  const range = presetDateRange(preset)
  customDateFrom.value = range.dateFrom
  customDateTo.value = range.dateTo
}

// Editing the date inputs switches the dashboard to a custom range.
const onCustomDateChange = () => {
  activePreset.value = 'custom'
}

// Clicking a chart bucket zooms the dashboard into that bucket's period
// (e.g. clicking a quarter bar in year view selects that quarter).
const onBucketSelect = (range: { start: string; end: string }) => {
  activePreset.value = 'custom'
  customDateFrom.value = range.start
  customDateTo.value = range.end
}

const dateRange = computed(() => {
  if (customDateFrom.value && customDateTo.value) {
    return {
      dateFrom: customDateFrom.value,
      dateTo: customDateTo.value
    }
  }
  const preset = activePreset.value === 'custom' ? 'month' : activePreset.value
  return presetDateRange(preset)
})

const dateLabel = computed(() => {
  return `${dateRange.value.dateFrom} → ${dateRange.value.dateTo}`
})

const companyIdsArg = computed(() =>
  showCompanyFilter.value && selectedCompanyIds.value.length > 0
    ? selectedCompanyIds.value
    : undefined
)

const companyIdsFilter = computed(() =>
  companyIdsArg.value ? companyIdsArg.value : []
)
const dateFromFilter = computed(() => dateRange.value.dateFrom)
const dateToFilter = computed(() => dateRange.value.dateTo)

const { stats } = useAdminGetDashboardStatsQuery({
  companyIds: companyIdsFilter,
  dateFrom: dateFromFilter,
  dateTo: dateToFilter
})

const paidRevenue = computed(() => {
  const s = stats.value as DashboardStatsResponse | undefined
  if (!s) return null
  return s.paidRevenueSeries ?? null
})

// Clickable bucket ranges aligned with the chart labels (one per bar).
const revenueBuckets = computed(
  () =>
    (stats.value as DashboardStatsResponse | undefined)?.paidRevenueSeries
      ?.buckets ?? []
)

// Explain how the chart is binned (day/week/month) so the user understands
// what each point represents.
const revenueBinLabel = computed(() => {
  const s = stats.value as DashboardStatsResponse | undefined
  const granularity = s?.granularity ?? 'month'
  return lang.value.dashboard.admin.revenue.chart.bin[granularity]
})

// Sum a series' values to get the period total for each document type.
const sumSeries = (data: number[] | undefined): number =>
  (data ?? []).reduce((acc, value) => acc + (value ?? 0), 0)

const revenueInvoices = computed(() =>
  sumSeries(
    paidRevenue.value?.series.find((s) => s.status === InvoiceStatus.PAID)?.data
  )
)
const revenueBills = computed(() =>
  sumSeries(
    paidRevenue.value?.series.find((s) => s.status === InvoiceStatus.BILL)?.data
  )
)
const revenueReceipts = computed(() =>
  sumSeries(
    paidRevenue.value?.series.find((s) => s.status === InvoiceStatus.RECEIPT)
      ?.data
  )
)

const revenueChartData = computed(() => ({
  labels: paidRevenue.value?.labels ?? [],
  datasets: [
    {
      label: lang.value.dashboard.admin.revenue.invoices,
      data: (paidRevenue.value?.series.find(
        (s) => s.status === InvoiceStatus.PAID
      )?.data ?? []) as number[],
      borderColor: '#4caf50',
      backgroundColor: '#4caf50'
    },
    {
      label: lang.value.dashboard.admin.revenue.bills,
      data: (paidRevenue.value?.series.find(
        (s) => s.status === InvoiceStatus.BILL
      )?.data ?? []) as number[],
      borderColor: '#2196f3',
      backgroundColor: '#2196f3'
    },
    {
      label: lang.value.dashboard.admin.revenue.receipts,
      data: (paidRevenue.value?.series.find(
        (s) => s.status === InvoiceStatus.RECEIPT
      )?.data ?? []) as number[],
      borderColor: '#ff9800',
      backgroundColor: '#ff9800'
    }
  ]
}))

const statusCountRows = computed(
  () => (stats.value as DashboardStatsResponse | undefined)?.statusCounts ?? []
)

const upcomingIncome = computed(
  () => (stats.value as DashboardStatsResponse | undefined)?.upcomingIncome
)

const paymentMethodSplit = computed(
  () =>
    (stats.value as DashboardStatsResponse | undefined)?.paymentMethodSplit ??
    []
)

const debtorInvoices = computed(() =>
  topDebtorsFromStatusCounts(statusCountRows.value)
)

const debtorBills = computed(() =>
  topBillsFromStatusCounts(statusCountRows.value)
)

const actionItems = computed<ActionItemsProps>(() => {
  const s = stats.value as DashboardStatsResponse | undefined
  return aggregateActionItems(s?.statusCounts ?? [], s?.overdueAging ?? [])
})

const onNavigate = (type: string, label?: string) => {
  if (type === 'open') {
    void router.push({ path: '/admin/invoices', query: { status: 'open' } })
  } else if (type === 'overdue') {
    void router.push({
      path: '/admin/invoices',
      query: { status: 'open', overdue: label ?? 'needsReminder' }
    })
  }
}

const eventTypesFilter = ref<ActivityEventType[]>([])
const activityLimit = ref<number>(20)
const { activity } = useAdminGetDashboardActivityQuery({
  companyIds: companyIdsFilter,
  eventTypes: eventTypesFilter,
  limit: activityLimit
})

const activityEntries = computed<ActivityEntry[]>(() => {
  const a = activity.value as { entries?: ActivityEntry[] } | undefined
  return a?.entries ?? []
})
</script>

<style scoped>
.dashboard-company-filter :deep(.q-field__control) {
  flex-wrap: wrap;
  height: auto;
  min-height: 56px;
  padding-top: 4px;
  padding-bottom: 4px;
}
</style>
