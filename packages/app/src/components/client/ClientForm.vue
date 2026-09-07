<template>
  <q-form ref="formRef">
    <div class="grid grid-cols-12 gap-3">
      <form-input
        v-bind="input"
        v-model="modelValue.companyName"
        :label="lang.client.fields.companyName"
        class="md:col-span-3 col-span-12"
        bottom-slots
        lazy-rules
        name="name"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.contactPersonName"
        :label="lang.client.fields.contactPersonName"
        class="md:col-span-3 col-span-12"
        bottom-slots
        lazy-rules
        name="contactPersonName"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.address"
        class="md:col-span-3 col-span-12"
        required
        field="address"
        bottom-slots
        lazy-rules
        name="address"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.postalCode"
        class="md:col-span-3 col-span-12"
        required
        field="postalCode"
        bottom-slots
        lazy-rules
        name="postalCode"
      />

      <form-input
        v-bind="input"
        v-model="modelValue.city"
        class="md:col-span-3 col-span-12"
        required
        field="city"
        bottom-slots
        lazy-rules
        name="city"
      />
      <country-select
        :model-value="modelValue.country as ISO3166"
        @update:model-value="setCountry"
        :label="lang.client.fields.country"
        :countries="countryOptions"
        filled
        class="md:col-span-3 col-span-12"
        bottom-slots
        lazy-rules
        name="country"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.vatIdNumber"
        :label="lang.client.fields.vatIdNumber"
        class="md:col-span-3 col-span-12"
        bottom-slots
        lazy-rules
        name="vatIdNumber"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.cocNumber"
        :label="lang.client.fields.cocNumber"
        class="md:col-span-3 col-span-12"
        bottom-slots
        lazy-rules
        name="cocNumber"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.email"
        :label="lang.client.fields.email"
        class="md:col-span-3 col-span-12"
        required
        bottom-slots
        lazy-rules
        name="email"
      />

      <account-select
        v-if="filteredAccounts"
        v-model="modelValue.accountId"
        class="col-span-12 md:col-span-3"
        :filtered-options="filteredAccounts"
        :hint="lang.client.messages.linkAccount"
        @filter="
          ($event: {
            ids: number[]
            searchPhrase: string
            done: (success?: boolean) => void
          }) => emit('filter:accounts', $event)
        "
      >
        <template #prepend>
          <q-icon name="i-mdi-search" />
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
import {
  FormInput,
  CountrySelect,
  type ISO3166
} from '@simsustech/quasar-components/form'
import { countryOptions } from '../../configuration.js'

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
  filteredAccounts?: readonly {
    id?: number
    name?: string | null
    email?: string
    roles?: string[] | null
  }[]
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

type ClientDraft = Omit<Client, 'country'> & { country: ISO3166 | '' }
const initialValue: ClientDraft = {
  companyName: '',
  address: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
  contactPersonName: ''
}

const modelValue = ref<ClientDraft>(initialValue)

const setCountry = (value: ISO3166) => {
  modelValue.value.country = value
}

// const $q = useQuasar()
const lang = useLang()

const formRef = ref<QForm>()

const setValue = (newValue: Client) => {
  modelValue.value = extend(
    {},
    initialValue,
    newValue
  ) as unknown as ClientDraft
}

const submit: InstanceType<typeof ResponsiveDialog>['$props']['onSubmit'] = ({
  done
}) => {
  formRef.value?.validate().then((success) => {
    if (success) {
      return emit('submit', {
        data: modelValue.value as Client,
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
