<template>
  <q-form ref="formRef">
    <div class="row">
      <form-input
        v-bind="input"
        v-model="modelValue.companyName"
        :label="lang.client.fields.companyName"
        class="col-md-3 col-12"
        bottom-slots
        lazy-rules
        name="name"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.contactPersonName"
        :label="lang.client.fields.contactPersonName"
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
        :label="lang.client.fields.country"
        class="col-md-3 col-12"
        bottom-slots
        lazy-rules
        name="country"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.vatIdNumber"
        :label="lang.client.fields.vatIdNumber"
        class="col-md-3 col-12"
        bottom-slots
        lazy-rules
        name="vatIdNumber"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.email"
        :label="lang.client.fields.email"
        class="col-md-3 col-12"
        required
        bottom-slots
        lazy-rules
        name="email"
      />

      <account-select
        v-if="filteredAccounts"
        v-model="modelValue.accountId"
        class="col-12 col-md-3"
        :filtered-options="filteredAccounts"
        :hint="lang.client.messages.linkAccount"
        @filter="($event) => emit('filter:accounts', $event)"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </account-select>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import type { Client } from '@slimfact/api/zod'
import { type QFormProps, type QInputProps, type QForm, extend } from 'quasar'
import { useLang } from '../../lang/index.js'
import { ref } from 'vue'
import { type ResponsiveDialog } from '@simsustech/quasar-components'
import { FormInput } from '@simsustech/quasar-components/form'
import { Account } from '@slimfact/api/zod'

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
  filteredAccounts?: Account[]
}
defineProps<Props>()
const emit = defineEmits<{
  (
    e: 'submit',
    {
      data,
      done
    }: {
      data: Client
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'filter:accounts',
    {
      ids,
      searchPhrase,
      done
    }: {
      ids: number[]
      searchPhrase: string
      done: (success?: boolean) => void
    }
  ): void
}>()

const initialValue: Client = {
  companyName: '',
  address: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
  contactPersonName: ''
}

const modelValue = ref<Client>(initialValue)

// const $q = useQuasar()
const lang = useLang()

const formRef = ref<QForm>()

const setValue = (newValue: Client) => {
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
