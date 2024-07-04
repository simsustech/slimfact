<template>
  <q-btn-toggle
    :model-value="modelValue"
    push
    toggle-color="primary"
    :options="options"
    @update:model-value="($event) => emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import { QBtnToggle } from 'quasar'
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
