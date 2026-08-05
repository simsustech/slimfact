<template>
  <q-card>
    <q-card-section>
      <div class="text-h6">
        {{ lang.dashboard.admin.upcomingIncome.title }}
      </div>
      <div class="q-mt-xs text-subtitle1">
        <Price
          v-if="totalAmount > 0"
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
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Price from '../Price.vue'
import { useLang } from '../../lang/index.js'

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
}>()

const lang = useLang()
const router = useRouter()

// The backend already orders by due date and returns at most 3 rows; keep
// the component defensive about missing entries.
const nextRows = computed<UpcomingInvoiceRow[]>(() =>
  (props.next ?? []).slice(0, 3)
)

// Open the admin invoices list filtered to this document.
const onRowClick = (row: UpcomingInvoiceRow) => {
  router.push(`/admin/invoices/${row.documentUuid}`)
}
</script>
