<template>
  <q-item>
    <q-item-section>
      <q-item-label overline>
        {{ `${lang.numberPrefix.numberPrefix}: ${modelValue.numberPrefix}` }}
      </q-item-label>
      <q-item-label>
        {{
          `${lang.initialNumberForPrefix.fields.initialNumber}: ${modelValue.initialNumber}`
        }}
      </q-item-label>
      <q-item-label v-if="modelValue.company">
        {{ modelValue.company.name }}
      </q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { useLang } from '../../lang/index.js'

export interface Props {
  modelValue: {
    company: { name: string } | null
    numberPrefix: string
    initialNumber: number
  }
}
defineProps<Props>()

const lang = useLang()
</script>
