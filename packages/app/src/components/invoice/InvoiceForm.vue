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
        required
        class="col-md-4 col-12"
        :filtered-options="filteredClients"
        :rules="[
          (val) =>
            !!val ||
            !!modelValue.clientDetails?.email ||
            lang.client.validations.fieldRequired
        ]"
        @filter="filterClients"
      >
        <template #append>
          <q-btn
            v-if="modelValue.clientDetails?.email && !modelValue.clientId"
            icon="edit"
            flat
            @click.stop="openUpdateClientDialog"
          />
        </template>
      </client-select>
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
      <!-- <form-input
        v-model="modelValue.numberPrefix"
        class="col-md-4 col-12"
        :label="lang.invoice.fields.numberPrefix"
        bottom-slots
        lazy-rules
        name="numberPrefix"
      /> -->
      <q-input
        :model-value="modelValue.requiredDownPaymentAmount / 100"
        :label="lang.invoice.fields.requiredDownPaymentAmount"
        class="col-12 col-md-4"
        :prefix="currencySymbols[modelValue.currency]"
        :lang="$q.lang.isoName"
        type="number"
        step="0.01"
        @update:model-value="
          modelValue.requiredDownPaymentAmount = Math.round(
            Number($event) * 100
          )
        "
      />
      <q-input
        v-model="modelValue.projectId"
        class="col-md-4 col-12"
        :label="lang.invoice.fields.projectId"
        bottom-slots
      />
    </div>
    <div class="row items-center">
      {{ lang.invoice.lines }} <q-btn flat round icon="add" @click="addLine" />
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

    <q-input
      v-model="modelValue.notes"
      :label="lang.invoice.fields.notes"
      type="textarea"
    />
  </q-form>

  <responsive-dialog ref="updateDialogRef" persistent @submit="submitClient">
    <client-form ref="updateClientFormRef" @submit="updateClient"></client-form>
  </responsive-dialog>
</template>

<script setup lang="ts">
import {
  CurrencySelect,
  LocaleSelect
} from '@simsustech/quasar-components/form'
import {
  type RawNewInvoice,
  type ClientDetails,
  type RawInvoiceLine,
  type RawInvoiceDiscount,
  type RawInvoiceSurcharge
} from '@modular-api/fastify-checkout'
import { useLang } from '../../lang/index.js'
import { ref, toRefs, watch, nextTick } from 'vue'
import CompanySelect from '../company/CompanySelect.vue'
import ClientSelect from '../client/ClientSelect.vue'
import {
  InvoiceLineItem,
  InvoiceLineDialog
} from '@modular-api/quasar-components/checkout'
import { QForm, extend, useQuasar } from 'quasar'
import { ResponsiveDialog } from '@simsustech/quasar-components'
import NumberPrefixSelect from '../numberPrefix/NumberPrefixSelect.vue'
import { NumberPrefix, Invoice, Company } from '@slimfact/api/zod'
import ClientForm from '../client/ClientForm.vue'

export interface Props {
  filteredCompanies: Company[]
  filteredClients: ClientDetails[]
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
      data: RawNewInvoice
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

const initialValue: Invoice = {
  companyId: NaN,
  clientId: NaN,
  companyPrefix: '',
  numberPrefixTemplate: '',
  currency: 'EUR',
  locale: 'en-US',
  lines: [],
  discounts: [],
  surcharges: [],
  paymentTermDays: 14,
  projectId: null,
  requiredDownPaymentAmount: 0
}

const { filteredCompanies } = toRefs(props)

const modelValue = ref<Invoice>(initialValue)

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
const setValue = (newValue: RawNewInvoice) => {
  modelValue.value = extend(true, {}, initialValue, newValue)
  modelValue.value.companyId = newValue.companyId || newValue.companyDetails.id
  modelValue.value.clientId = newValue.clientId || newValue.clientDetails.id
}

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

const currencySymbols = ref({
  EUR: '€',
  USD: '$'
})

const updateClientFormRef = ref<typeof ClientForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateClientDialog = () => {
  const data = modelValue.value.clientDetails
  updateDialogRef.value?.functions.open()
  nextTick(() => {
    updateClientFormRef.value?.functions.setValue(data)
  })
}

const submitClient: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterUpdate = (success?: boolean) => {
    done(success)
  }
  updateClientFormRef.value?.functions.submit({ done: afterUpdate })
}

const updateClient: InstanceType<
  typeof ClientForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  modelValue.value.clientDetails = data

  done()
}

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
        invoiceLine: array[index],
        currency: modelValue.value.currency,
        locale: modelValue.value.locale,
        deleteFn
      }
    })
  }
}

const functions = ref({
  submit,
  setValue
})
defineExpose({
  functions
})
</script>
