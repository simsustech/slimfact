<template>
  <q-styled-card>
    <template #title>
      <div class="row justify-between">
        <svg-avatar :model-value="modelValue.logoSvg" />
        <div class="col text-right">
          <q-btn outline rounded icon="edit" @click="update(modelValue)">
          </q-btn>
        </div>
      </div>
    </template>

    <q-card-section>
      <q-list>
        <form-item
          v-for="field in fields"
          :key="field"
          :model-value="modelValue[field]"
          :label="lang.company.fields[field]"
        />
      </q-list>
    </q-card-section>
  </q-styled-card>
</template>

<script setup lang="ts">
import { QStyledCard } from '@simsustech/quasar-components'
import { FormItem } from '@simsustech/quasar-components/form'
import { ref } from 'vue'
import type { CompanyDetails } from '@modular-api/fastify-checkout'
import { useLang } from '../../lang/index.js'
import SvgAvatar from '../SvgAvatar.vue'
import { Company } from '@slimfact/api/zod'

export interface Props {
  modelValue: CompanyDetails
}
defineProps<Props>()

const emit = defineEmits<{
  (
    e: 'update',
    {
      data,
      done
    }: {
      data: CompanyDetails
      done: (success?: boolean) => void
    }
  ): void
}>()

const lang = useLang()
const fields = ref([
  'name',
  'prefix',
  'contactPersonName',
  'address',
  'postalCode',
  'city',
  'country',
  'telephoneNumber',
  'email',
  'emailBcc',
  'website',
  'cocNumber',
  'vatIdNumber',
  'iban',
  'bic'
] as const)

const update = (company: Company) => {
  function done() {
    //
  }
  emit('update', { data: company, done })
}
</script>
