<template>
  <q-form ref="formRef">
    <div class="row justify-center">
      <svg-avatar v-model="modelValue.logoSvg" allow-change />
    </div>
    <div class="row q-col-gutter-y-md">
      <form-input
        v-bind="input"
        v-model="modelValue.name"
        class="col-md-3 col-12"
        required
        field="name"
        bottom-slots
        lazy-rules
        name="name"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.contactPersonName"
        :label="lang.company.fields.contactPersonName"
        class="col-md-3 col-12"
        bottom-slots
        lazy-rules
        name="contactPersonName"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.address"
        class="col-md-3 col-12"
        required
        field="address"
        bottom-slots
        lazy-rules
        name="address"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.postalCode"
        class="col-md-3 col-12"
        required
        field="postalCode"
        bottom-slots
        lazy-rules
        name="postalCode"
      />

      <form-input
        v-bind="input"
        v-model="modelValue.city"
        class="col-md-3 col-12"
        required
        field="city"
        bottom-slots
        lazy-rules
        name="city"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.country"
        :label="lang.company.fields.country"
        class="col-md-3 col-12"
        required
        bottom-slots
        lazy-rules
        name="country"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.telephoneNumber"
        class="col-md-3 col-12"
        required
        field="telephoneNumber"
        bottom-slots
        lazy-rules
        name="telephoneNumber"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.website"
        :label="lang.company.fields.website"
        class="col-md-3 col-12"
        bottom-slots
        lazy-rules
        name="website"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.cocNumber"
        :label="lang.company.fields.cocNumber"
        class="col-md-3 col-12"
        required
        bottom-slots
        lazy-rules
        name="cocNumber"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.iban"
        :label="lang.company.fields.iban"
        class="col-md-3 col-12"
        required
        bottom-slots
        lazy-rules
        name="iban"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.bic"
        :label="lang.company.fields.bic"
        class="col-md-3 col-12"
        required
        bottom-slots
        lazy-rules
        name="bic"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.vatIdNumber"
        :label="lang.company.fields.vatIdNumber"
        class="col-md-3 col-12"
        required
        bottom-slots
        lazy-rules
        name="vatIdNumber"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.prefix"
        :label="lang.company.fields.prefix"
        :readonly="prefixLocked"
        class="col-md-3 col-12"
        required
        bottom-slots
        lazy-rules
        name="prefix"
        :hint="lang.company.helpers.prefix"
      >
        <template #append>
          <q-icon
            class="clickable"
            :name="prefixLocked ? 'lock_open' : 'lock'"
            @click="prefixLocked = !prefixLocked"
          />
        </template>
      </form-input>
      <form-input
        v-bind="input"
        v-model="modelValue.email"
        :label="lang.company.fields.email"
        class="col-md-3 col-12"
        required
        bottom-slots
        lazy-rules
        name="email"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.emailBcc"
        :label="lang.company.fields.emailBcc"
        class="col-md-3 col-12"
        bottom-slots
        lazy-rules
        name="emailBcc"
        :hint="lang.company.helpers.emailBcc"
      />
      <number-prefix-select
        v-model="modelValue.defaultNumberPrefixTemplate"
        class="col-md-3 col-12"
        :label="lang.company.fields.defaultNumberPrefixTemplate"
        :filtered-options="filteredNumberPrefixes"
        bottom-slots
        lazy-rules
        name="defaultNumberPrefixTemplate"
      />
      <locale-select
        v-model="modelValue.defaultLocale"
        :label="lang.company.fields.defaultLocale"
        class="col-md-3 col-12"
        bottom-slots
        lazy-rules
        name="defaultLocale"
      />
      <currency-select
        v-model="modelValue.defaultCurrency"
        :label="lang.company.fields.defaultCurrency"
        class="col-md-3 col-12"
        bottom-slots
        lazy-rules
        name="defaultCurrency"
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
import SvgAvatar from '../SvgAvatar.vue'
import NumberPrefixSelect from '../numberPrefix/NumberPrefixSelect.vue'
import {
  LocaleSelect,
  CurrencySelect
} from '@simsustech/quasar-components/form'
import { Company, NumberPrefix } from '@slimfact/api/zod'
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
  filteredNumberPrefixes: NumberPrefix[]
}
defineProps<Props>()
const emit = defineEmits<{
  (
    e: 'submit',
    {
      data,
      done
    }: {
      data: Company
      done: (success?: boolean) => void
    }
  ): void
}>()

const initialValue: Company = {
  name: '',
  address: '',
  postalCode: '',
  city: '',
  country: '',
  telephoneNumber: '',
  email: '',
  cocNumber: '',
  iban: '',
  bic: '',
  vatIdNumber: '',
  contactPersonName: '',
  logoSvg: null,
  prefix: '',
  website: null,
  defaultNumberPrefixTemplate: '',
  defaultLocale: 'en-US',
  defaultCurrency: 'EUR'
}

const modelValue = ref<Company>(initialValue)

// const $q = useQuasar()
const lang = useLang()

const formRef = ref<QForm>()

const setValue = (newValue: Company) => {
  modelValue.value = extend({}, initialValue, newValue)
  if (newValue.prefix) prefixLocked.value = true
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

const prefixLocked = ref(false)

const functions = ref({
  submit,
  setValue
})
defineExpose({
  functions
})
</script>
