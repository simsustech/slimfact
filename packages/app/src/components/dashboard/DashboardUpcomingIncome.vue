<template>
  <q-card>
    <q-card-section>
      <div class="row items-center justify-between">
        <div class="text-h6">
          {{ lang.dashboard.admin.upcomingIncome.title }}
        </div>
        <q-btn-toggle
          v-model="mode"
          :options="[
            {
              label: lang.dashboard.admin.upcomingIncome.toggle.upcoming,
              value: 'upcoming'
            },
            {
              label: lang.dashboard.admin.upcomingIncome.toggle.overdue,
              value: 'overdue'
            }
          ]"
          dense
          unelevated
          no-caps
        />
      </div>

      <!-- Upcoming: open invoices that are not due yet -->
      <template v-if="mode === 'upcoming'">
        <div class="q-mt-xs text-subtitle1">
          <Price
            v-if="count > 0"
            :model-value="totalAmount"
            currency="EUR"
            class="q-mr-xs"
          />
          <span class="text-grey-7">
            {{ count }} {{ lang.dashboard.admin.upcomingIncome.invoices }}
          </span>
        </div>

        <q-list v-if="nextRows.length > 0" dense class="q-mt-sm">
          <q-item
            v-for="row in nextRows"
            :key="row.documentUuid"
            clickable
            v-ripple
            @click="onRowClick(row)"
          >
            <q-item-section>
              <q-item-label>
                <span class="text-weight-medium">
                  {{ row.documentNumber ?? '—' }}
                </span>
                <span class="text-grey-7 q-ml-xs">
                  {{ row.clientName ?? '—' }}
                </span>
              </q-item-label>
              <q-item-label caption>
                {{ lang.dashboard.admin.upcomingIncome.due }}
                {{ row.dueDate }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <Price
                v-if="row.amount > 0"
                :model-value="row.amount"
                currency="EUR"
              />
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="q-mt-sm text-grey-7 italic">
          {{ lang.dashboard.admin.upcomingIncome.empty }}
        </div>
      </template>

      <!-- Overdue: open invoices past their due date, per aging bucket -->
      <template v-else>
        <div class="q-mt-xs text-subtitle1">
          <Price
            v-if="overdueTotal > 0"
            :model-value="overdueTotal"
            currency="EUR"
            class="q-mr-xs"
          />
          <span class="text-grey-7">
            {{ overdueCount }}
            {{ lang.dashboard.admin.upcomingIncome.invoices }}
          </span>
        </div>

        <q-list v-if="overdueRows.length > 0" dense class="q-mt-sm">
          <q-item v-for="row in overdueRows" :key="row.key" dense>
            <q-item-section>
              <q-item-label>{{ row.label }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <Price :model-value="row.totalAmount" currency="EUR" />
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="q-mt-sm text-grey-7 italic">
          {{ lang.dashboard.admin.upcomingIncome.emptyOverdue }}
        </div>
      </template>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Price from '../Price.vue'
import { useLang } from '../../lang/index.js'
import { sumOverdueBuckets, type AggBucket } from './actionItems.js'

export interface UpcomingInvoiceRow {
  documentUuid: string
  documentNumber: string | null
  clientName: string | null
  amount: number
  dueDate: string | null
}

const props = defineProps<{
  count: number
  totalAmount: number
  next: UpcomingInvoiceRow[]
  overdue?: {
    needsReminder: AggBucket
    reminder1: AggBucket
    reminder2: AggBucket
    exhortation: AggBucket
  }
}>()

const lang = useLang()
const router = useRouter()
const mode = ref<'upcoming' | 'overdue'>('upcoming')

// The backend already orders by due date and returns at most 3 rows; keep
// the component defensive about missing entries.
const nextRows = computed<UpcomingInvoiceRow[]>(() =>
  (props.next ?? []).slice(0, 3)
)

const overdueTotal = computed(
  () => sumOverdueBuckets(props.overdue).totalAmount
)
const overdueCount = computed(() => sumOverdueBuckets(props.overdue).count)

// Aging buckets with lang labels, only the non-empty ones.
const overdueRows = computed(() => {
  if (!props.overdue) return []
  const labels = lang.value.dashboard.admin.actionItems.overdue
  const buckets: { key: string; label: string; totalAmount: number }[] = [
    {
      key: 'needsReminder',
      label: labels.needsReminder,
      totalAmount: props.overdue.needsReminder.totalAmount
    },
    {
      key: 'reminder1',
      label: labels.reminder1,
      totalAmount: props.overdue.reminder1.totalAmount
    },
    {
      key: 'reminder2',
      label: labels.reminder2,
      totalAmount: props.overdue.reminder2.totalAmount
    },
    {
      key: 'exhortation',
      label: labels.exhortation,
      totalAmount: props.overdue.exhortation.totalAmount
    }
  ]
  return buckets.filter((bucket) => bucket.totalAmount > 0)
})

// Open the admin invoices list filtered to this document.
const onRowClick = (row: UpcomingInvoiceRow) => {
  router.push(`/admin/invoices/${row.documentUuid}`)
}
</script>
