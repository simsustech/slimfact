<template>
  <q-form ref="formRef">
    <div class="row justify-center">
      <svg-avatar v-model="modelValue.logoSvg" allow-change />
    </div>
    <div class="row">
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
        class="col-md-3 col-12"
        required
        bottom-slots
        lazy-rules
        name="prefix"
      />
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
    </div>
  </q-form>
</template>

<script setup lang="ts">
import type { CompanyDetails } from '@modular-api/fastify-checkout'
import { type QFormProps, type QInputProps, type QForm, extend } from 'quasar'
import { useLang } from '../../lang/index.js'
import { ref } from 'vue'
import { type ResponsiveDialog } from '@simsustech/quasar-components'
import { FormInput } from '@simsustech/quasar-components/form'
import SvgAvatar from '../SvgAvatar.vue'

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
}
defineProps<Props>()
const emit = defineEmits<{
  (
    e: 'submit',
    {
      data,
      done
    }: {
      data: CompanyDetails
      done: (success?: boolean) => void
    }
  ): void
}>()

const initialValue: CompanyDetails = {
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
  website: null
}

const modelValue = ref<CompanyDetails>(initialValue)

// const $q = useQuasar()
const lang = useLang()

const formRef = ref<QForm>()

const setValue = (newValue: CompanyDetails) => {
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

const functions = ref({
  submit,
  setValue
})
defineExpose({
  functions
})
</script>
