<template>
  <q-card>
    <q-card-section>
      <div class="text-h6">
        {{ lang.dashboard.admin.paymentMethods.title }}
      </div>

      <div v-if="rows.length > 0" class="q-mt-sm">
        <div v-for="row in rows" :key="row.method" class="q-mt-sm">
          <div class="row items-center justify-between text-caption">
            <span>{{ row.label }}</span>
            <span>
              <Price
                v-if="row.totalAmount > 0"
                :model-value="row.totalAmount"
                currency="EUR"
              />
              <span class="text-grey-7 q-ml-xs">{{ row.percent }}%</span>
            </span>
          </div>
          <div class="payment-method-bar q-mt-xs">
            <div
              class="payment-method-bar__fill"
              :style="{ width: `${row.percent}%` }"
            />
          </div>
        </div>
      </div>
      <div v-else class="q-mt-sm text-grey-7 italic">
        {{ lang.dashboard.admin.revenue.chart.noData }}
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Price from '../Price.vue'
import { useLang } from '../../lang/index.js'
import {
  labelPaymentMethods,
  withPercentages,
  type PaymentMethodRow
} from './paymentMethods.js'

const props = defineProps<{
  rows: PaymentMethodRow[]
}>()

const lang = useLang()

const rows = computed(() =>
  labelPaymentMethods(
    withPercentages(props.rows ?? []),
    lang.value.payment.methods as Record<string, string>
  )
)
</script>

<style scoped>
.payment-method-bar {
  background: rgba(0, 0, 0, 0.08);
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
}

.payment-method-bar__fill {
  background: var(--q-primary);
  border-radius: 4px;
  height: 100%;
}
</style>
