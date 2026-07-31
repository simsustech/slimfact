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
          v-for="entry in filteredEntries"
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
          <template #body>
            <Price
              v-if="entry.amount > 0"
              :model-value="entry.amount"
              currency="EUR"
            />
          </template>
        </q-timeline-entry>
      </q-timeline>
      <div v-else class="empty">
        {{ lang.dashboard.admin.empty.noData }}
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Price from '../Price.vue'
import { useLang } from '../../lang/index.js'

export interface ActivityEntry {
  type: string
  documentUuid: string
  clientName: string | null
  amount: number
  timestamp: string
}

export type ActivityType =
  | 'invoiceOpened'
  | 'billCreated'
  | 'payment'
  | 'reminder'
  | 'exhortation'

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

const filteredEntries = computed(() => {
  if (selectedEventType.value === 'all') return props.entries
  return props.entries.filter((e) => e.type === selectedEventType.value)
})

const iconFor = (type: string) => {
  switch (type) {
    case 'invoiceOpened':
      return 'mdi-file-document-outline'
    case 'billCreated':
      return 'mdi-receipt-text-outline'
    case 'payment':
      return 'mdi-credit-card-check-outline'
    case 'reminder':
      return 'mdi-bell-outline'
    case 'exhortation':
      return 'mdi-alert-octagon-outline'
    default:
      return 'mdi-circle-medium'
  }
}

const colorFor = (type: string) => {
  switch (type) {
    case 'invoiceOpened':
      return 'primary'
    case 'billCreated':
      return 'teal'
    case 'payment':
      return 'green'
    case 'reminder':
      return 'orange'
    case 'exhortation':
      return 'red'
    default:
      return 'grey'
  }
}

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

const relativeTimeFormat = new Intl.RelativeTimeFormat('en-US', {
  numeric: 'auto'
})

const formatRelative = (timestamp: string) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  if (absSeconds < 60) return relativeTimeFormat.format(diffSeconds, 'second')
  if (absSeconds < 3600)
    return relativeTimeFormat.format(Math.round(diffSeconds / 60), 'minute')
  if (absSeconds < 86_400)
    return relativeTimeFormat.format(Math.round(diffSeconds / 3600), 'hour')
  if (absSeconds < 2_592_000)
    return relativeTimeFormat.format(Math.round(diffSeconds / 86_400), 'day')
  if (absSeconds < 31_536_000)
    return relativeTimeFormat.format(
      Math.round(diffSeconds / 2_592_000),
      'month'
    )
  return relativeTimeFormat.format(Math.round(diffSeconds / 31_536_000), 'year')
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
