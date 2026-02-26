<template>
  <q-styled-card>
    <template #title>
      <div class="row justify-between">
        <svg-avatar :model-value="modelValue.logoSvg" />
        <div class="col text-right">
          <q-btn outline icon="i-mdi-edit" @click="update(modelValue)"> </q-btn>
        </div>
      </div>
    </template>

    <q-card-section>
      <q-list>
        <form-item
          v-for="field in fields"
          :key="field"
          :model-value="field === 'country' ? countryLabel : modelValue[field]"
          :label="lang.company.fields[field]"
        />
      </q-list>
    </q-card-section>
  </q-styled-card>
</template>

<script setup lang="ts">
import { QStyledCard } from '@simsustech/quasar-components'
import { FormItem, ISO3166 } from '@simsustech/quasar-components/form'
import { computed, ref } from 'vue'
import type { CompanyDetails } from '@modular-api/fastify-checkout'
import { useLang } from '../../lang/index.js'
import SvgAvatar from '../SvgAvatar.vue'
import { Company } from '@slimfact/api/zod'
import { useLang as useFormLang } from '@simsustech/quasar-components/form'

export interface Props {
  modelValue: CompanyDetails
}
const { modelValue } = defineProps<Props>()

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
const formLang = useFormLang()

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

const countryLabel = computed(
  () => formLang.value.countries[modelValue.country as ISO3166]
)
</script>
