<template>
  <q-icon :name="icon" :color="color">
    <q-tooltip>
      {{ lang.invoice.status[modelValue] }}
    </q-tooltip></q-icon
  >
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'
import { useLang } from '../../lang/index.js'
import { InvoiceStatus } from '@slimfact/api/zod'

const InvoiceStatusIcons = {
  [InvoiceStatus.OPEN]: 'pending',
  [InvoiceStatus.PAID]: 'paid',
  [InvoiceStatus.CONCEPT]: 'edit_note',
  [InvoiceStatus.RECEIPT]: 'receipt',
  [InvoiceStatus.CANCELED]: 'cancel',
  [InvoiceStatus.BILL]: 'request_quote'
}
const InvoiceStatusColors = {
  [InvoiceStatus.OPEN]: 'orange',
  [InvoiceStatus.PAID]: 'green',
  [InvoiceStatus.CONCEPT]: 'black',
  [InvoiceStatus.RECEIPT]: 'green',
  [InvoiceStatus.CANCELED]: 'red',
  [InvoiceStatus.BILL]: 'grey'
}

interface Props {
  modelValue: InvoiceStatus
}
const props = defineProps<Props>()
const lang = useLang()
const { modelValue } = toRefs(props)
const icon = computed(() => InvoiceStatusIcons[modelValue.value])
const color = computed(() => InvoiceStatusColors[modelValue.value])
</script>
