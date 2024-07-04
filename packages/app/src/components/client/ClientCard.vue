<template>
  <q-styled-card>
    <template #title>
      <div class="row justify-between">
        {{ modelValue.companyName || modelValue.contactPersonName }}
      </div>
    </template>

    <q-card-section>
      <q-list>
        <form-item
          v-for="field in fields"
          :key="field"
          :model-value="modelValue[field]"
          :label="lang.client.fields[field]"
        />
      </q-list>
    </q-card-section>
  </q-styled-card>
</template>

<script setup lang="ts">
import { QStyledCard } from '@simsustech/quasar-components'
import { FormItem } from '@simsustech/quasar-components/form'
import { ref } from 'vue'
import type { ClientDetails } from '@modular-api/fastify-checkout'
import { useLang } from '../../lang/index.js'

export interface Props {
  modelValue: ClientDetails
}
defineProps<Props>()

// const emit = defineEmits<{
//   (
//     e: 'update',
//     {
//       data,
//       done
//     }: {
//       data: ClientDetails
//       done: (success?: boolean) => void
//     }
//   ): void
// }>()

const lang = useLang()
const fields = ref([
  'contactPersonName',
  'address',
  'postalCode',
  'city',
  'country',
  'email'
] as const)

// const update = (data: ClientDetails) => {
//   function done() {
//     //
//   }
//   emit('update', { data, done })
// }
</script>
