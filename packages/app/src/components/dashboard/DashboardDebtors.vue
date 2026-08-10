<template>
  <q-card>
    <q-card-section>
      <div class="row items-center justify-between">
        <div class="text-h6">{{ lang.dashboard.admin.debtors.title }}</div>
        <q-btn-toggle
          v-model="mode"
          :options="[
            {
              label: lang.dashboard.admin.debtors.toggle.invoices,
              value: 'invoices'
            },
            { label: lang.dashboard.admin.debtors.toggle.bills, value: 'bills' }
          ]"
          dense
          unelevated
          no-caps
        />
      </div>

      <q-list v-if="rows.length > 0">
        <q-item
          v-for="row in rows"
          :key="row.companyId"
          clickable
          @click="onRowClick(row)"
        >
          <q-item-section>
            <q-item-label>{{ row.companyName ?? '—' }}</q-item-label>
            <q-linear-progress
              :value="row.totalAmount / maxAmount"
              class="q-mt-xs"
              color="primary"
              track-color="grey-3"
              :height="8"
            />
          </q-item-section>
          <q-item-section side>
            <Price :model-value="row.totalAmount" currency="EUR" />
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else class="text-caption q-mt-sm text-grey-7">
        {{ lang.dashboard.admin.debtors.empty }}
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Price from '../Price.vue'
import { useLang } from '../../lang/index.js'
import type { DebtorRow } from './topDebtors.js'

const props = defineProps<{
  invoices: DebtorRow[]
  bills: DebtorRow[]
}>()

const lang = useLang()
const router = useRouter()

type Mode = 'invoices' | 'bills'
const mode = ref<Mode>('invoices')

const rows = computed<DebtorRow[]>(() =>
  mode.value === 'invoices' ? props.invoices : props.bills
)

const maxAmount = computed(() =>
  Math.max(1, ...rows.value.map((row) => row.totalAmount))
)

const onRowClick = (row: DebtorRow) => {
  if (row.companyId == null) return
  // Show only this company's documents of the active status.
  const status = mode.value === 'invoices' ? 'open' : 'bill'
  void router.push({
    path: '/admin/invoices',
    query: { companyId: String(row.companyId), status }
  })
}
</script>
