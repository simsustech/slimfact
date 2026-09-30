<template>
  <q-card>
    <q-card-section>
      <div class="[font:var(--q-title-medium)]">
        {{ lang.dashboard.admin.revenue.title }}
      </div>
      <div class="[font:var(--q-body-small)] q-mb-md">
        {{ dateLabel }}
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-4">
          <q-card flat bordered>
            <q-card-section>
              <div class="[font:var(--q-label-small)]">
                {{ lang.dashboard.admin.revenue.invoices }}
              </div>
              <Price :model-value="revenueInvoices" currency="EUR" />
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-4">
          <q-card flat bordered>
            <q-card-section>
              <div class="[font:var(--q-label-small)]">
                {{ lang.dashboard.admin.revenue.bills }}
              </div>
              <Price :model-value="revenueBills" currency="EUR" />
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-4">
          <q-card flat bordered>
            <q-card-section>
              <div class="[font:var(--q-label-small)]">
                {{ lang.dashboard.admin.revenue.receipts }}
              </div>
              <Price :model-value="revenueReceipts" currency="EUR" />
            </q-card-section>
          </q-card>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import Price from '../Price.vue'
import { useLang } from '../../lang/index.js'

export interface Props {
  revenueInvoices: number | null
  revenueBills: number | null
  revenueReceipts: number | null
  dateLabel: string
}

defineProps<Props>()

const lang = useLang()
</script>
