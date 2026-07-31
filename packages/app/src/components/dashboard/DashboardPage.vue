<template>
  <div class="dashboard-page">
    <h1 class="text-h4 q-mb-md">
      {{ lang.dashboard.admin.title }}
    </h1>

    <div v-if="showCompanyFilter" class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
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
        />
      </div>
    </div>

    <div
      v-if="companies.length > 0 && selectedCompanyIds.length === 0"
      class="empty-row"
    >
      {{ lang.dashboard.admin.empty.noCompanySelected }}
    </div>

    <template v-else>
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12">
          <q-card>
            <q-card-section class="row items-center q-gutter-md">
              <div class="text-subtitle1">
                {{ lang.dashboard.admin.revenue.title }}
              </div>
              <q-btn-toggle
                v-model="activePreset"
                :options="presetButtons"
                no-caps
                dense
                unelevated
              />
              <div class="col-auto row q-gutter-sm items-center">
                <q-input
                  v-model="customDateFrom"
                  type="date"
                  :label="lang.dashboard.admin.revenue.customRange"
                  dense
                  outlined
                  @update:model-value="onCustomDateChange"
                />
                <q-input
                  v-model="customDateTo"
                  type="date"
                  dense
                  outlined
                  @update:model-value="onCustomDateChange"
                />
              </div>
            </q-card-section>
            <q-card-section>
              <DashboardRevenueCards
                :revenue-invoices="paidRevenue"
                :revenue-bills="0"
                :date-label="dateLabel"
              />
              <div class="q-mt-md">
                <DashboardRevenueChart
                  :labels="[lang.dashboard.admin.revenue.invoices]"
                  :datasets="[
                    {
                      label: lang.dashboard.admin.revenue.invoices,
                      data: [paidRevenue ?? 0],
                      backgroundColor: '#2196f3'
                    }
                  ]"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-md-6">
          <DashboardStatusChart
            :labels="statusLabels"
            :counts="statusCounts"
            :total-amounts="statusTotalAmounts"
          />
        </div>
        <div class="col-12 col-md-6">
          <DashboardActionItems :items="actionItems" @navigate="onNavigate" />
        </div>
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-12">
          <DashboardRecentActivity :entries="activityEntries" />
        </div>
      </div>

      <div class="row q-col-gutter-md q-mt-md">
        <div class="col-12">
          <DashboardAdminMenuList />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface DashboardStatsResponse {
  paidRevenue: number
  outstandingTotal: number
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
}
import { useRouter } from 'vue-router'
import DashboardAdminMenuList from './DashboardAdminMenuList.vue'
import DashboardRevenueCards from './DashboardRevenueCards.vue'
import DashboardRevenueChart from './DashboardRevenueChart.vue'
import DashboardStatusChart from './DashboardStatusChart.vue'
import DashboardActionItems, {
  type ActionItemsProps
} from './DashboardActionItems.vue'
import DashboardRecentActivity, {
  type ActivityEntry
} from './DashboardRecentActivity.vue'
import { useAdminGetCompaniesQuery } from '../../queries/admin/companies.js'
import { useAdminGetDashboardStatsQuery } from '../../queries/admin/dashboard.js'
import { InvoiceStatus } from '@modular-api/fastify-checkout/types'
import { useLang } from '../../lang/index.js'
import { agingLabelForReminderCount } from '../../dashboard/aging.js'

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

type Preset = 'today' | 'week' | 'month' | 'quarter' | 'year'

const activePreset = ref<Preset>('month')
const customDateFrom = ref<string>('')
const customDateTo = ref<string>('')

const presetButtons = computed(() => [
  { label: lang.value.dashboard.admin.revenue.today, value: 'today' },
  { label: lang.value.dashboard.admin.revenue.week, value: 'week' },
  { label: lang.value.dashboard.admin.revenue.month, value: 'month' },
  { label: lang.value.dashboard.admin.revenue.quarter, value: 'quarter' },
  { label: lang.value.dashboard.admin.revenue.year, value: 'year' }
])

const onCustomDateChange = () => {
  activePreset.value = 'month'
}

const dateRange = computed(() => {
  const now = new Date()
  let dateFrom: Date
  let dateTo = now
  switch (activePreset.value) {
    case 'today':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week': {
      const day = (now.getDay() + 6) % 7
      dateFrom = new Date(now)
      dateFrom.setDate(now.getDate() - day)
      dateFrom.setHours(0, 0, 0, 0)
      break
    }
    case 'month':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3
      dateFrom = new Date(now.getFullYear(), q, 1)
      break
    }
    case 'year':
      dateFrom = new Date(now.getFullYear(), 0, 1)
      break
    default:
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      break
  }
  if (customDateFrom.value && customDateTo.value) {
    return {
      dateFrom: customDateFrom.value,
      dateTo: customDateTo.value
    }
  }
  return {
    dateFrom: toIso(dateFrom),
    dateTo: toIso(dateTo)
  }
})

const toIso = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateLabel = computed(() => {
  return `${dateRange.value.dateFrom} → ${dateRange.value.dateTo}`
})

const companyIdsArg = computed(() =>
  showCompanyFilter.value && selectedCompanyIds.value.length > 0
    ? selectedCompanyIds.value
    : undefined
)

const { stats, refresh: refreshStats } = useAdminGetDashboardStatsQuery()

watch(
  () => dateRange.value,
  () => {
    void refreshStats()
  }
)

watch(companyIdsArg, () => {
  void refreshStats()
})

const paidRevenue = computed(() => {
  const s = stats.value as DashboardStatsResponse | undefined
  if (!s) return null
  return s.paidRevenue ?? 0
})

const statusLabels = computed(() => [
  lang.value.dashboard.admin.statusChart.status.concept,
  lang.value.dashboard.admin.statusChart.status.open,
  lang.value.dashboard.admin.statusChart.status.paid,
  lang.value.dashboard.admin.statusChart.status.overdue,
  lang.value.dashboard.admin.statusChart.status.canceled,
  lang.value.dashboard.admin.statusChart.status.bill,
  lang.value.dashboard.admin.statusChart.status.receipt
])

const STATUS_VALUES = [
  InvoiceStatus.CONCEPT,
  InvoiceStatus.OPEN,
  InvoiceStatus.PAID,
  InvoiceStatus.CANCELED,
  InvoiceStatus.BILL,
  InvoiceStatus.RECEIPT
] as const

const statusRowsByStatus = computed(() => {
  type Row = { count: number; totalAmount: number }
  const empty = (): Row => ({ count: 0, totalAmount: 0 })
  const map = new Map<InvoiceStatus, Row>()
  for (const status of STATUS_VALUES) map.set(status, empty())
  const s = stats.value as DashboardStatsResponse | undefined
  for (const row of s?.statusCounts ?? []) {
    const target = map.get(row.status)
    if (target) {
      target.count += row.count
      target.totalAmount += row.totalAmount
    }
  }
  return map
})

const statusCounts = computed(() =>
  STATUS_VALUES.map(
    (status) => statusRowsByStatus.value.get(status)?.count ?? 0
  )
)

const statusTotalAmounts = computed(() =>
  STATUS_VALUES.map(
    (status) => statusRowsByStatus.value.get(status)?.totalAmount ?? 0
  )
)

const actionItems = computed<ActionItemsProps>(() => {
  const empty = {
    count: 0,
    totalAmount: 0
  }
  const s = stats.value as DashboardStatsResponse | undefined

  const open = s?.statusCounts?.find((r) => r.status === InvoiceStatus.OPEN)
  const overdue = {
    needsReminder: empty,
    reminder1: empty,
    reminder2: empty,
    exhortation: empty
  }
  for (const row of s?.overdueAging ?? []) {
    const bucket = agingLabelForReminderCount(row.reminderCount)
    if (bucket === 'exhortation') overdue.exhortation = row
    else if (bucket === 'reminder2') overdue.reminder2 = row
    else if (bucket === 'reminder1') overdue.reminder1 = row
    else overdue.needsReminder = row
  }
  return {
    open: {
      count: open?.count ?? 0,
      totalAmount: open?.totalAmount ?? 0
    },
    overdue
  }
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

import { useAdminGetDashboardActivityQuery } from '../../queries/admin/dashboard.js'
const { activity, refresh: refreshActivity } =
  useAdminGetDashboardActivityQuery()

watch(companyIdsArg, () => {
  void refreshActivity()
})

const activityEntries = computed<ActivityEntry[]>(() => {
  const a = activity.value as { entries?: ActivityEntry[] } | undefined
  return a?.entries ?? []
})
</script>

<style scoped>
.empty-row {
  padding: 24px;
  text-align: center;
  color: rgba(0, 0, 0, 0.6);
  font-style: italic;
}
</style>
