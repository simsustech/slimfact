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
          :model-value="field === 'country' ? countryLabel : modelValue[field]"
          :label="lang.client.fields[field]"
        />
      </q-list>
    </q-card-section>
  </q-styled-card>
</template>

<script setup lang="ts">
import { QStyledCard } from '@simsustech/quasar-components'
import { ref, computed } from 'vue'
import type { ClientDetails } from '@modular-api/fastify-checkout'
import { useLang } from '../../lang/index.js'
import { FormItem, type ISO3166 } from '@simsustech/quasar-components/form'
import { useLang as useFormLang } from '@simsustech/quasar-components/form'

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
const formLang = useFormLang()

const fields = ref([
  'contactPersonName',
  'address',
  'postalCode',
  'city',
  'country',
  'vatIdNumber',
  'email'
] as const)

// const update = (data: ClientDetails) => {
//   function done() {
//     //
//   }
//   emit('update', { data, done })
// }
const countryLabel = computed(
  () => formLang.value.countries[modelValue.country as ISO3166]
)
</script>
