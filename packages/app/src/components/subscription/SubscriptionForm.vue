<template>
  <q-form ref="formRef">
    <div class="row">
      <company-select
        v-model="modelValue.companyId"
        class="col-md-4 col-12"
        :filtered-options="filteredCompanies"
        required
        @filter="filterCompanies"
      />

      <client-select
        v-model="modelValue.clientId"
        class="col-md-4 col-12"
        :filtered-options="filteredClients"
        required
        @filter="filterClients"
      />
      <number-prefix-select
        v-model="modelValue.numberPrefixTemplate"
        class="col-md-4 col-12"
        :filtered-options="filteredNumberPrefixes"
        bottom-slots
        lazy-rules
        required
      />
    </div>
    <div class="row">
      <currency-select
        v-model="modelValue.currency"
        required
        class="col-md-4 col-12"
        bottom-slots
        lazy-rules
        name="currency"
      />
      <locale-select
        v-model="modelValue.locale"
        required
        class="col-md-4 col-12"
        bottom-slots
        lazy-rules
        name="locale"
      />
      <q-input
        v-model.number="modelValue.paymentTermDays"
        class="col-md-4 col-12"
        :label="`${lang.invoice.fields.paymentTermDays}*`"
        bottom-slots
        lazy-rules
        type="number"
        name="paymentTermDays"
        :rules="[(val) => !!val]"
      />
    </div>
    <div class="row">
      <q-select
        v-model="modelValue.type"
        class="col-md-3 col-12"
        :options="typeOptions"
        :label="lang.subscription.fields.type"
        map-options
        emit-value
      />
      <date-input
        v-model="modelValue.startDate"
        :label="lang.subscription.fields.startDate"
        format="DD-MM-YYYY"
        clearable
        required
        class="col-md-3 col-12"
        :date="{
          noUnset: true,
          defaultView: 'Years',
          options: futureDateOptionsFn,
          firstDayOfWeek: '1'
        }"
      />
      <date-input
        v-model="modelValue.endDate"
        :label="lang.subscription.fields.endDate"
        format="DD-MM-YYYY"
        clearable
        class="col-md-3 col-12"
        :date="{
          noUnset: true,
          defaultView: 'Years',
          options: (date) => futureDateOptionsFn(date, modelValue.startDate),
          firstDayOfWeek: '1'
        }"
      />
      <cron-schedule-input
        v-model="modelValue.cronSchedule"
        class="col-md-3 col-12"
      />
    </div>
    <div class="row items-center">
      Lines <q-btn flat round icon="add" @click="addLine" />
    </div>

    <invoice-line-row
      v-for="(line, index) in modelValue.lines"
      :key="index"
      v-model="modelValue.lines[index]"
      :currency="modelValue.currency"
      :locale="modelValue.locale"
      @delete="
        modelValue.lines = [
          ...modelValue.lines.slice(0, index),
          ...modelValue.lines.slice(index + 1)
        ]
      "
    ></invoice-line-row>

    <div class="row items-center">
      Discounts <q-btn flat round icon="add" @click="addDiscount" />
    </div>
    <invoice-discount-surcharge-row
      v-for="(line, index) in modelValue.discounts"
      :key="index"
      v-model="modelValue.discounts[index]"
      :currency="modelValue.currency"
      :locale="modelValue.locale"
      @delete="
        modelValue.discounts = [
          ...modelValue.discounts.slice(0, index),
          ...modelValue.discounts.slice(index + 1)
        ]
      "
    />

    <div class="row items-center">
      Surcharges <q-btn flat round icon="add" @click="addSurcharge" />
    </div>
    <invoice-discount-surcharge-row
      v-for="(line, index) in modelValue.surcharges"
      :key="index"
      v-model="modelValue.surcharges[index]"
      :currency="modelValue.currency"
      :locale="modelValue.locale"
      @delete="
        modelValue.surcharges = [
          ...modelValue.surcharges.slice(0, index),
          ...modelValue.surcharges.slice(index + 1)
        ]
      "
    />
  </q-form>
</template>

<script setup lang="ts">
import {
  CurrencySelect,
  LocaleSelect,
  DateInput,
  CronScheduleInput
} from '@simsustech/quasar-components/form'
import {
  type CompanyDetails,
  type ClientDetails
} from '@modular-api/fastify-checkout'
import { useLang } from '../../lang/index.js'
import { computed, ref } from 'vue'
import CompanySelect from '../company/CompanySelect.vue'
import ClientSelect from '../client/ClientSelect.vue'
import {
  InvoiceLineRow,
  InvoiceDiscountSurchargeRow
} from '@modular-api/quasar-components/checkout'
import { QForm, extend } from 'quasar'
import { ResponsiveDialog } from '@simsustech/quasar-components'
import NumberPrefixSelect from '../numberPrefix/NumberPrefixSelect.vue'
import { NumberPrefix, Subscription } from '@slimfact/api/zod'

export interface Props {
  filteredCompanies: CompanyDetails[]
  filteredClients: ClientDetails[]
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
      data: Subscription
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
  (
    e: 'filter:clients',
    {
      searchPhrase,
      done
    }: {
      searchPhrase: string
      done: (success?: boolean) => void
    }
  ): void
}>()

const initialValue: Subscription = {
  name: '',
  companyId: NaN,
  clientId: NaN,
  numberPrefixTemplate: '',
  currency: 'EUR',
  locale: 'en-US',
  lines: [],
  discounts: [],
  surcharges: [],
  paymentTermDays: 14,
  cronSchedule: '0 0 1 * *',
  type: 'invoice',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: null
}

const modelValue = ref<Subscription>(initialValue)

const lang = useLang()

const filterCompanies: InstanceType<
  typeof CompanySelect
>['$props']['onFilter'] = ({ searchPhrase, done }) =>
  emit('filter:companies', { searchPhrase, done })

const filterClients: InstanceType<
  typeof ClientSelect
>['$props']['onFilter'] = ({ searchPhrase, done }) =>
  emit('filter:clients', { searchPhrase, done })

const addLine = () => {
  modelValue.value.lines.push({
    listPrice: 0,
    listPriceIncludesTax: true,
    taxRate: 21,
    description: '',
    quantity: 1000,
    quantityPerMille: true,
    discount: 0
  })
}

const addDiscount = () => {
  if (!modelValue.value.discounts) modelValue.value.discounts = []
  modelValue.value.discounts.push({
    listPrice: 0,
    listPriceIncludesTax: true,
    taxRate: 21,
    description: ''
  })
}

const addSurcharge = () => {
  if (!modelValue.value.surcharges) modelValue.value.surcharges = []
  modelValue.value.surcharges.push({
    listPrice: 0,
    listPriceIncludesTax: true,
    taxRate: 21,
    description: ''
  })
}

const formRef = ref<QForm>()
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
const setValue = (newValue: Subscription) => {
  modelValue.value = extend(true, {}, initialValue, newValue)
  modelValue.value.lines = newValue.lines
  modelValue.value.discounts = newValue.discounts
  modelValue.value.surcharges = newValue.surcharges
}

const futureDateOptionsFn = (date: string, startDate?: string) => {
  return (
    date >=
    (startDate ? startDate : new Date().toISOString().slice(0, 10)).replaceAll(
      '-',
      '/'
    )
  )
}

const typeOptions = computed(() => [
  {
    label: lang.value.invoice.invoice,
    value: 'invoice'
  },
  {
    label: lang.value.bill.bill,
    value: 'bill'
  }
])
const functions = ref({
  submit,
  setValue
})
defineExpose({
  functions
})
</script>
