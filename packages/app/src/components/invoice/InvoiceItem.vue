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
      <q-item-label caption>
        <q-icon
          v-if="
            modelValue.amountPaid &&
            modelValue.amountPaid >= modelValue.totalIncludingTax
          "
          name="check"
          color="green"
        >
          <q-tooltip>
            {{ lang.invoice.status.paid }}
          </q-tooltip>
        </q-icon>
        <price
          :model-value="modelValue.totalIncludingTax"
          :currency="modelValue.currency"
        />
      </q-item-label>
    </q-item-section>
    <q-item-section side>
      <q-btn flat round icon="more_vert">
        <q-menu>
          <q-list>
            <q-item
              v-if="
                ![InvoiceStatus.CONCEPT, InvoiceStatus.CANCELED].includes(
                  modelValue.status
                )
              "
              v-close-popup
              :href="`/invoice/${modelValue.uuid}`"
              target="_blank"
              clickable
            >
              <q-item-section avatar>
                <q-icon name="open_in_new" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ lang.invoice.labels.open }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import type { Invoice } from '@modular-api/fastify-checkout'
import InvoiceStatusIcon from '../../components/invoice/InvoiceStatusIcon.vue'
import Price from '../Price.vue'
import { useLang } from '../../lang/index.js'
import { InvoiceStatus } from '@modular-api/fastify-checkout/types'

export interface Props {
  modelValue: Invoice
}
defineProps<Props>()

const lang = useLang()
</script>
