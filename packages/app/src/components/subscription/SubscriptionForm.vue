<template>
  <q-form ref="formRef">
    <div class="row">
      <company-select
        v-model="modelValue.companyId"
        class="col-md-6 col-12"
        :filtered-options="filteredCompanies"
        required
        @filter="filterCompanies"
      />

      <client-select
        v-model="modelValue.clientId"
        class="col-md-6 col-12"
        :filtered-options="filteredClients"
        required
        @filter="filterClients"
      />
    </div>
    <div
      v-show="
        !Number.isNaN(modelValue.companyId) &&
        !Number.isNaN(modelValue.clientId)
      "
    >
      <div class="row">
        <q-select
          v-model="modelValue.type"
          class="col-md-4 col-12"
          :options="typeOptions"
          :label="lang.subscription.fields.type"
          map-options
          emit-value
        />
        <number-prefix-select
          v-model="modelValue.numberPrefixTemplate"
          :disable="!modelValue.companyId"
          class="col-md-4 col-12"
          :filtered-options="filteredNumberPrefixes"
          bottom-slots
          lazy-rules
          required
          :hint="computedNumberPrefix"
        />
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
          :locales="languageLocales"
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
        <date-input
          v-model="modelValue.startDate"
          :label="lang.subscription.fields.startDate"
          format="DD-MM-YYYY"
          clearable
          required
          class="col-md-4 col-12"
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
          class="col-md-4 col-12"
          :date="{
            noUnset: true,
            defaultView: 'Years',
            options: (date) => futureDateOptionsFn(date, modelValue.startDate),
            firstDayOfWeek: '1'
          }"
        />
        <cron-schedule-input
          v-model="modelValue.cronSchedule"
          class="col-md-4 col-12"
        />
      </div>
      <div class="row items-center">
        {{ lang.invoice.lines }}
        <q-btn flat round icon="add" @click="addLine" />
      </div>

      <q-list separator>
        <invoice-line-item
          v-for="(line, index) in modelValue.lines"
          :key="index"
          v-ripple
          :model-value="line"
          :locale="modelValue.locale"
          :currency="modelValue.currency"
          editable
          @click="openInvoiceLineDialog(modelValue.lines, index)"
        ></invoice-line-item>
      </q-list>

      <div class="row items-center">
        {{ lang.invoice.discounts }}
        <q-btn flat round icon="add" @click="addDiscount" />
      </div>
      <q-list separator>
        <invoice-line-item
          v-for="(discount, index) in modelValue.discounts"
          :key="index"
          v-ripple
          :model-value="discount"
          :locale="modelValue.locale"
          :currency="modelValue.currency"
          editable
          @click="openInvoiceLineDialog(modelValue.discounts, index)"
        ></invoice-line-item>
      </q-list>

      <div class="row items-center">
        {{ lang.invoice.surcharges }}
        <q-btn flat round icon="add" @click="addSurcharge" />
      </div>
      <q-list separator>
        <invoice-line-item
          v-for="(surcharge, index) in modelValue.surcharges"
          :key="index"
          v-ripple
          :model-value="surcharge"
          :locale="modelValue.locale"
          :currency="modelValue.currency"
          editable
          @click="openInvoiceLineDialog(modelValue.surcharges, index)"
        ></invoice-line-item>
      </q-list>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import {
  CurrencySelect,
  LocaleSelect,
  DateInput,
  CronScheduleInput
} from '@simsustech/quasar-components/form'
import { useLang } from '../../lang/index.js'
import { computed, ref, toRefs, watch } from 'vue'
import CompanySelect from '../company/CompanySelect.vue'
import ClientSelect from '../client/ClientSelect.vue'
import {
  InvoiceLineItem,
  InvoiceLineDialog
} from '@modular-api/quasar-components/checkout'
import { QForm, extend, useQuasar } from 'quasar'
import { ResponsiveDialog } from '@simsustech/quasar-components'
import NumberPrefixSelect from '../numberPrefix/NumberPrefixSelect.vue'
import { Client, Company, NumberPrefix, Subscription } from '@slimfact/api/zod'
import {
  type RawInvoiceDiscount,
  type RawInvoiceLine,
  type RawInvoiceSurcharge
} from '@modular-api/fastify-checkout'
import { computeNumberPrefix } from 'src/tools.js'

export interface Props {
  filteredCompanies: Company[]
  filteredClients: Client[]
  filteredNumberPrefixes: NumberPrefix[]
}

const props = defineProps<Props>()

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

const $q = useQuasar()

const { filteredCompanies, filteredClients } = toRefs(props)

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

const languageLocales = ref([
  {
    icon: 'i-flagpack-nl',
    isoName: 'nl'
  },
  {
    icon: 'i-flagpack-us',
    isoName: 'en-US'
  }
])

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
  openInvoiceLineDialog(
    modelValue.value.lines,
    modelValue.value.lines.length - 1
  )
}

const addDiscount = () => {
  if (!modelValue.value.discounts) modelValue.value.discounts = []
  modelValue.value.discounts.push({
    listPrice: 0,
    listPriceIncludesTax: true,
    taxRate: 21,
    description: ''
  })
  openInvoiceLineDialog(
    modelValue.value.discounts,
    modelValue.value.discounts.length - 1
  )
}

const addSurcharge = () => {
  if (!modelValue.value.surcharges) modelValue.value.surcharges = []
  modelValue.value.surcharges.push({
    listPrice: 0,
    listPriceIncludesTax: true,
    taxRate: 21,
    description: ''
  })
  openInvoiceLineDialog(
    modelValue.value.surcharges,
    modelValue.value.surcharges.length - 1
  )
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
  modelValue.value.companyId = newValue.companyId
  modelValue.value.clientId = newValue.clientId
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

watch(
  () => modelValue.value.companyId,
  (newVal) => {
    const defaultNumberPrefixTemplate = filteredCompanies.value.find(
      (company) => company.id === newVal
    )?.defaultNumberPrefixTemplate
    if (defaultNumberPrefixTemplate) {
      modelValue.value.numberPrefixTemplate = defaultNumberPrefixTemplate
    }

    const defaultLocale = filteredCompanies.value.find(
      (company) => company.id === newVal
    )?.defaultLocale
    if (defaultLocale) modelValue.value.locale = defaultLocale

    const defaultCurrency = filteredCompanies.value.find(
      (company) => company.id === newVal
    )?.defaultCurrency
    if (defaultCurrency) modelValue.value.currency = defaultCurrency
  }
)

const openInvoiceLineDialog = (
  array?: (RawInvoiceLine | RawInvoiceDiscount | RawInvoiceSurcharge)[] | null,
  index?: number
) => {
  if (array && index !== void 0) {
    const deleteFn = () => {
      if (array && index !== void 0) {
        array.splice(index, 1)
      }
    }
    $q.dialog({
      component: InvoiceLineDialog,
      componentProps: {
        persistent: true,
        invoiceLine: array[index],
        currency: modelValue.value.currency,
        locale: modelValue.value.locale,
        deleteFn
      }
    })
  }
}

const computedNumberPrefix = computed(() => {
  if (
    modelValue.value.companyId &&
    modelValue.value.clientId &&
    filteredCompanies.value.length &&
    filteredClients.value.length
  ) {
    const company = filteredCompanies.value.find(
      (company) => company.id === modelValue.value.companyId
    )

    const client = filteredClients.value.find(
      (client) => client.id === modelValue.value.clientId
    )

    return computeNumberPrefix({
      numberPrefixTemplate: modelValue.value.numberPrefixTemplate,
      companyDetails: {
        prefix: company!.prefix
      },
      clientDetails: {
        number: client!.number
      }
    })
  }
  return ''
})

const functions = ref({
  submit,
  setValue
})
defineExpose({
  functions
})
</script>
