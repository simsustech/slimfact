<template>
  <q-form ref="formRef">
    <div class="grid grid-cols-12 gap-3">
      <form-input
        v-bind="input"
        v-model="modelValue.numberPrefix"
        :label="lang.numberPrefix.numberPrefix"
        class="md:col-span-4 col-span-12"
        required
        bottom-slots
        lazy-rules
        name="numberPrefix"
        :hint="lang.initialNumberForPrefix.messages.numberPrefixHint"
      />
      <company-select
        v-model="modelValue.companyId"
        class="md:col-span-4 col-span-12"
        :filtered-options="filteredCompanies"
        required
        @filter="filterCompanies"
      />

      <q-input
        v-model.number="modelValue.initialNumber"
        class="md:col-span-4 col-span-12"
        type="number"
        :label="lang.initialNumberForPrefix.fields.initialNumber"
      />
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { type QFormProps, type QInputProps, type QForm, extend } from 'quasar'
import { useLang } from '../../lang/index.js'
import { ref } from 'vue'
import { type ResponsiveDialog } from '@simsustech/quasar-components'
import { FormInput } from '@simsustech/quasar-components/form'
import { InitialNumberForPrefix } from '@slimfact/api/zod'
import CompanySelect from '../company/CompanySelect.vue'
import type { CompanyDetails } from '@modular-api/fastify-checkout'
export interface Props {
  form?: QFormProps & Partial<HTMLFormElement> & Partial<HTMLDivElement>
  input?: Omit<
    QInputProps,
    | 'id'
    | 'name'
    | 'modelValue'
    | 'label'
    | 'rules'
    | 'type'
    | 'lazy-rules'
    | 'autofocus'
    | ('label' & { style?: Partial<CSSStyleDeclaration> })
  >
  filteredCompanies: CompanyDetails[]
}
defineProps<Props>()
const emit = defineEmits<{
  (
    e: 'submit',
    {
      data,
      done
    }: {
      data: InitialNumberForPrefix
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'filter:companies',
    {
      searchPhrase,
      done
    }: {
      searchPhrase: string
      done: (success?: boolean) => void
    }
  ): void
}>()

const initialValue: InitialNumberForPrefix = {
  numberPrefix: '',
  companyId: NaN,
  initialNumber: 1
}

const modelValue = ref<InitialNumberForPrefix>(initialValue)

// const $q = useQuasar()
const lang = useLang()

const formRef = ref<QForm>()

const setValue = (newValue: InitialNumberForPrefix) => {
  modelValue.value = extend({}, initialValue, newValue)
}

const submit: InstanceType<typeof ResponsiveDialog>['$props']['onSubmit'] = ({
  done
}) => {
  formRef.value?.validate().then((success) => {
    if (success) {
      return emit('submit', {
        data: modelValue.value,
        done
      })
    }
  })
  done(false)
}

const filterCompanies: InstanceType<
  typeof CompanySelect
>['$props']['onFilter'] = ({ searchPhrase, done }) =>
  emit('filter:companies', { searchPhrase, done })

const functions = ref({
  submit,
  setValue
})
defineExpose({
  functions
})
</script>
