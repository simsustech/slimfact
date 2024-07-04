<template>
  {{ modelValue ? format(modelValue) : '-' }}
</template>

<script lang="ts">
export default {
  name: 'PriceComponent'
}
</script>

<script setup lang="ts">
import { toRefs } from 'vue'
import { useQuasar } from 'quasar'

export interface Props {
  modelValue: number | null
  currency: 'EUR' | 'USD'
  locale?: string
}
const props = defineProps<Props>()
const $q = useQuasar()
const { locale, currency } = toRefs(props)

const format = (value: number) =>
  Intl.NumberFormat(locale.value || $q.lang.isoName, {
    maximumFractionDigits: 2,
    style: 'currency',
    currency: currency.value
  }).format(value / 100)
</script>
