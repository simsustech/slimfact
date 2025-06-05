<template>
  <q-avatar>
    <invoice-status-icon :model-value="modelValue" size="md" />

    <q-icon
      v-if="
        [InvoiceStatus.BILL, InvoiceStatus.OPEN].includes(modelValue) && paid
      "
      name="i-mdi-check"
      color="green"
      rounded
      size="xs"
      padding="xs"
      style="position: relative; left: 12px; bottom: 10px"
      ><q-tooltip>
        {{ lang.invoice.status.paid }}
      </q-tooltip>
    </q-icon>
    <q-icon
      v-else-if="
        [InvoiceStatus.BILL, InvoiceStatus.OPEN].includes(modelValue) &&
        downPaymentReceived
      "
      name="i-mdi-check"
      color="orange"
      rounded
      size="xs"
      padding="xs"
      style="position: relative; left: 12px; bottom: 10px"
      ><q-tooltip>
        {{ lang.invoice.messages.downPaymentReceived }}
      </q-tooltip>
    </q-icon>
  </q-avatar>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
import InvoiceStatusIcon from './InvoiceStatusIcon.vue'
import { useLang } from '../../lang/index.js'
import { InvoiceStatus } from '@modular-api/fastify-checkout/types'

interface Props {
  modelValue: InvoiceStatus
  paid?: boolean
  downPaymentReceived?: boolean
}
const props = defineProps<Props>()
const { modelValue } = toRefs(props)
const lang = useLang()
</script>
