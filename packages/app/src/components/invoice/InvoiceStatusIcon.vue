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
  [InvoiceStatus.OPEN]: 'i-mdi-receipt-pending',
  [InvoiceStatus.PAID]: 'i-mdi-dollar',
  [InvoiceStatus.CONCEPT]: 'i-mdi-note-edit',
  [InvoiceStatus.RECEIPT]: 'i-mdi-receipt',
  [InvoiceStatus.CANCELED]: 'i-mdi-cancel',
  [InvoiceStatus.BILL]: 'i-mdi-receipt-outline'
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
