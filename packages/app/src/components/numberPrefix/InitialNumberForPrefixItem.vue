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
      <q-item-label>
        {{ modelValue.company.name }}
      </q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import type { CompanyDetails } from '@modular-api/fastify-checkout'
import { NumberPrefix } from '@slimfact/api/zod'
import { useLang } from '../../lang/index.js'

export interface Props {
  modelValue: {
    company: CompanyDetails
    numberPrefix: NumberPrefix
    initialNumber: number
  }
}
defineProps<Props>()

const lang = useLang()
</script>
