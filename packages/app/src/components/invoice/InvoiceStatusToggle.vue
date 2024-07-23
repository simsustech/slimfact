<template>
  <q-btn-toggle
    v-if="$q.screen.gt.md"
    :model-value="modelValue"
    push
    toggle-color="primary"
    :options="options"
    @update:model-value="($event) => emit('update:modelValue', $event)"
  />
  <q-btn-dropdown
    v-else
    :label="
      options.find((option) => option.value === modelValue)?.label ||
      lang.invoice.fields.status
    "
  >
    <q-list>
      <q-item
        v-for="option in options"
        :key="option.value"
        clickable
        @click="emit('update:modelValue', option.value)"
      >
        <q-item-section>
          <q-item-label>{{ option.label }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>
</template>

<script setup lang="ts">
import { QBtnToggle } from 'quasar'
import { useLang } from '../../lang/index.js'
import { computed } from 'vue'
import { InvoiceStatus } from '@slimfact/api/zod'
import { useQuasar } from 'quasar'

export interface Props {
  modelValue: string | null
}
defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', val: string): void }>()

const $q = useQuasar()
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
