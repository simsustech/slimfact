<template>
  <q-card>
    <q-card-section>
      <div class="row items-center q-mb-sm">
        <div class="text-h6 col">
          {{ lang.dashboard.admin.recentActivity.title }}
        </div>
        <div class="col-auto">
          <q-select
            v-model="selectedEventType"
            :options="filterOptions"
            :label="lang.dashboard.admin.recentActivity.filter.label"
            emit-value
            map-options
            dense
            outlined
          />
        </div>
      </div>

      <q-timeline v-if="filteredEntries.length > 0" layout="dense">
        <q-timeline-entry
          v-for="entry in pagedEntries"
          :key="`${entry.type}-${entry.documentUuid}-${entry.timestamp}`"
          :icon="iconFor(entry.type)"
          :color="colorFor(entry.type)"
        >
          <template #title>
            {{ labelFor(entry.type) }}
          </template>
          <template #subtitle>
            {{ entry.clientName ?? '—' }} —
            {{ formatRelative(entry.timestamp) }}
          </template>
          <template #default>
            <Price
              v-if="entry.amount > 0"
              :model-value="entry.amount"
              currency="EUR"
            />
            <span
              v-if="paymentInvoiceText(entry, forInvoiceLabel)"
              class="q-ml-xs"
            >
              {{ paymentInvoiceText(entry, forInvoiceLabel) }}
            </span>
          </template>
        </q-timeline-entry>
      </q-timeline>
      <div v-else class="empty">
        {{ lang.dashboard.admin.empty.noData }}
      </div>

      <div
        v-if="filteredEntries.length > 0"
        class="grid grid-cols-12 items-center gap-3 q-mt-md"
      >
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
            :disable="!(filteredEntries.length && page && rowsPerPage)"
            :max="Math.ceil(filteredEntries.length / rowsPerPage)"
            :max-pages="5"
            direction-links
          />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Price from '../Price.vue'
import { useLang } from '../../lang/index.js'
import {
  colorForActivity,
  filterActivity,
  iconForActivity,
  paginateEntries,
  paymentInvoiceText
} from './recentActivity.js'

export interface ActivityEntry {
  type: string
  documentUuid: string
  documentNumber: string | null
  clientName: string | null
  amount: number
  timestamp: string
}

const props = defineProps<{
  entries: ActivityEntry[]
}>()

const lang = useLang()

const selectedEventType = ref<string>('all')

const filterOptions = computed(() => [
  { label: lang.value.dashboard.admin.recentActivity.filter.all, value: 'all' },
  {
    label: lang.value.dashboard.admin.recentActivity.filter.invoiceOpened,
    value: 'invoiceOpened'
  },
  {
    label: lang.value.dashboard.admin.recentActivity.filter.billCreated,
    value: 'billCreated'
  },
  {
    label: lang.value.dashboard.admin.recentActivity.filter.payment,
    value: 'payment'
  },
  {
    label: lang.value.dashboard.admin.recentActivity.filter.reminder,
    value: 'reminder'
  },
  {
    label: lang.value.dashboard.admin.recentActivity.filter.exhortation,
    value: 'exhortation'
  }
])

const filteredEntries = computed(() =>
  filterActivity(props.entries, selectedEventType.value)
)

const page = ref(1)
const rowsPerPage = ref(5)

const pagedEntries = computed(() =>
  paginateEntries(filteredEntries.value, page.value, rowsPerPage.value)
)

watch(selectedEventType, () => {
  page.value = 1
})
watch(rowsPerPage, () => {
  page.value = 1
})
const iconFor = iconForActivity
const colorFor = colorForActivity
const forInvoiceLabel = computed(
  () => lang.value.dashboard.admin.recentActivity.forInvoice
)

const labelFor = (type: string) => {
  switch (type) {
    case 'invoiceOpened':
      return lang.value.dashboard.admin.recentActivity.filter.invoiceOpened
    case 'billCreated':
      return lang.value.dashboard.admin.recentActivity.filter.billCreated
    case 'payment':
      return lang.value.dashboard.admin.recentActivity.filter.payment
    case 'reminder':
      return lang.value.dashboard.admin.recentActivity.filter.reminder
    case 'exhortation':
      return lang.value.dashboard.admin.recentActivity.filter.exhortation
    default:
      return type
  }
}

interface RelativeTimeRange {
  maxSeconds: number
  divisor: number
  unit: Intl.RelativeTimeFormatUnit
}

// Pick the coarsest unit whose range still fits: seconds < 1m, minutes <
// 1h, hours < 1d, days < 30d, months < 365d, years beyond.
const relativeTimeRanges: RelativeTimeRange[] = [
  { maxSeconds: 60, divisor: 1, unit: 'second' },
  { maxSeconds: 3_600, divisor: 60, unit: 'minute' },
  { maxSeconds: 86_400, divisor: 3_600, unit: 'hour' },
  { maxSeconds: 2_592_000, divisor: 86_400, unit: 'day' },
  { maxSeconds: 31_536_000, divisor: 2_592_000, unit: 'month' },
  { maxSeconds: Number.POSITIVE_INFINITY, divisor: 31_536_000, unit: 'year' }
]

const formatRelative = (timestamp: string) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const { divisor, unit } =
    relativeTimeRanges.find(
      (range) => Math.abs(diffSeconds) < range.maxSeconds
    ) ?? relativeTimeRanges[relativeTimeRanges.length - 1]
  // Create per call so the formatter follows the active UI language.
  return new Intl.RelativeTimeFormat(lang.value.isoName, {
    numeric: 'auto'
  }).format(Math.round(diffSeconds / divisor), unit)
}
</script>

<style scoped>
.empty {
  text-align: center;
  color: rgba(0, 0, 0, 0.6);
  font-style: italic;
  padding: 16px;
}
</style>
