<template>
  <q-item>
    <q-item-section avatar>
      <invoice-status-icon :model-value="modelValue.status" />
    </q-item-section>
    <q-item-section>
      <q-item-label overline>
        {{ modelValue.companyDetails.name }}
      </q-item-label>
      <q-item-label>
        <div class="row justify-between">
          <div class="col-9">
            {{
              modelValue.clientDetails.companyName ||
              modelValue.clientDetails.contactPersonName
            }}
          </div>
          <div class="col-3 text-right">
            <price
              :model-value="modelValue.totalIncludingTax"
              :currency="modelValue.currency"
            />
          </div>
        </div>
      </q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import type { Invoice } from '@modular-api/fastify-checkout'
import InvoiceStatusIcon from '../../components/invoice/InvoiceStatusIcon.vue'
import Price from '../Price.vue'
export interface Props {
  modelValue: Invoice
}
defineProps<Props>()
</script>
