<template>
  <q-select
    :model-value="modelValue"
    :options="options"
    :label="lang.invoice.fields.status"
    map-options
    emit-value
    clearable
    @update:model-value="($event) => emit('update:modelValue', $event)"
  >
  </q-select>
</template>

<script setup lang="ts">
import { QSelect } from 'quasar'
import { useLang } from '../../lang/index.js'
import { computed } from 'vue'
import { InvoiceStatus } from '@slimfact/api/zod'

export interface Props {
  modelValue: string | null
}
defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', val: string): void }>()

const lang = useLang()
const options = computed(() => [
  {
    label: lang.value.invoice.status.open,
    value: InvoiceStatus.OPEN
  },
  {
    label: lang.value.invoice.status.paid,
    value: InvoiceStatus.PAID
  },
  { label: lang.value.invoice.status.concept, value: InvoiceStatus.CONCEPT },
  // { label: lang.value.invoice.status.receipt, value: InvoiceStatus.RECEIPT },
  {
    label: lang.value.invoice.status.canceled,
    value: InvoiceStatus.CANCELED
  }
])
</script>
