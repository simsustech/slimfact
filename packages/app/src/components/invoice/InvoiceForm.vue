<template>
  <q-form v-if="filteredClients && filteredCompanies" ref="formRef">
    <div class="grid grid-cols-12 gap-3">
      <company-select
        v-model="modelValue.companyId"
        class="md:col-span-6 col-span-12"
        :filtered-options="filteredCompanies"
        required
        @filter="filterCompanies"
      />

      <client-select
        v-model="modelValue.clientId"
        required
        class="md:col-span-6 col-span-12"
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
            icon="i-mdi-edit"
            flat
            @click.stop="openUpdateClientDialog"
          />
        </template>
      </client-select>
    </div>
    <div
      v-show="
        !Number.isNaN(modelValue.companyId) &&
        !Number.isNaN(modelValue.clientId)
      "
    >
      <div class="grid grid-cols-12 gap-3">
        <number-prefix-select
          v-model="modelValue.numberPrefixTemplate"
          :disable="!modelValue.companyId"
          class="md:col-span-4 col-span-12"
          :filtered-options="filteredNumberPrefixes"
          bottom-slots
          lazy-rules
          required
          :hint="computedNumberPrefix"
        />
        <currency-select
          v-model="modelValue.currency"
          :disable="!modelValue.companyId"
          required
          class="md:col-span-4 col-span-12"
          bottom-slots
          lazy-rules
          name="currency"
        />
        <locale-select
          v-model="modelValue.locale"
          :disable="!modelValue.companyId"
          :locales="languageLocales"
          filled
          :borderless="false"
          required
          class="md:col-span-4 col-span-12"
          bottom-slots
          lazy-rules
          name="locale"
        />
        <q-input
          v-model.number="modelValue.paymentTermDays"
          :disable="!modelValue.companyId"
          class="md:col-span-4 col-span-12"
          :label="`${lang.invoice.fields.paymentTermDays}*`"
          bottom-slots
          lazy-rules
          type="number"
          name="paymentTermDays"
          :rules="[(val) => !!val]"
        />
        <q-input
          v-model="modelValue.projectId"
          :disable="!modelValue.companyId"
          class="md:col-span-4 col-span-12"
          :label="lang.invoice.fields.projectId"
          bottom-slots
        />

        <q-input
          :model-value="(modelValue.requiredDownPaymentAmount || 0) / 100"
          :label="lang.invoice.fields.requiredDownPaymentAmount"
          :disable="!modelValue.companyId"
          class="col-span-12 md:col-span-4"
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
      </div>
      <!-- <form-input
        v-model="modelValue.numberPrefix"
        class="md:col-span-4 col-span-12"
        :label="lang.invoice.fields.numberPrefix"
        bottom-slots
        lazy-rules
        name="numberPrefix"
      /> -->
      <!-- <div class="row items-center">
        {{ lang.invoice.lines }}
        <q-btn flat round icon="i-mdi-add" @click="addLine" />
      </div> -->

      <q-list bordered>
        <q-item-label header> {{ lang.invoice.lines }} </q-item-label>
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
        <q-item clickable @click="addLine">
          <q-item-section avatar>
            <q-icon name="i-mdi-add" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ lang.add }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <q-list bordered>
        <q-item-label header>
          {{ lang.invoice.discounts }}
        </q-item-label>
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

        <q-item clickable @click="addDiscount">
          <q-item-section avatar>
            <q-icon name="i-mdi-add" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ lang.add }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <q-list bordered>
        <q-item-label header>
          {{ lang.invoice.surcharges }}
        </q-item-label>
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

        <q-item clickable @click="addSurcharge">
          <q-item-section avatar>
            <q-icon name="i-mdi-add" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ lang.add }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <div class="q-pt-md grid grid-cols-12 gap-3">
        <q-input
          v-model="modelValue.notes"
          :label="lang.invoice.fields.notes"
          class="col-span-12"
          type="textarea"
        />
      </div>
    </div>
  </q-form>

  <responsive-dialog
    ref="updateDialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
    persistent
    @submit="submitClient"
  >
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
import { ref, toRefs, watch, computed } from 'vue'
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
import { computeNumberPrefix } from 'src/tools.js'
import { until } from '@vueuse/core'
import { languageLocales } from '../../configuration.js'

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

const { filteredCompanies, filteredClients } = toRefs(props)

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
    listPriceIncludesTax: includeTax.value,
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
const setValue = (newValue: RawNewInvoice) => {
  modelValue.value = extend(true, {}, initialValue, newValue)
  if (newValue.companyId && !Number.isNaN(newValue.companyId)) {
    modelValue.value.companyId = newValue.companyId
  } else if (
    newValue.companyDetails.id &&
    !Number.isNaN(newValue.companyDetails.id)
  ) {
    modelValue.value.companyId = newValue.companyDetails.id
  }
  if (newValue.clientId && !Number.isNaN(newValue.clientId)) {
    modelValue.value.clientId = newValue.clientId
  } else if (
    newValue.clientDetails.id &&
    !Number.isNaN(newValue.clientDetails.id)
  ) {
    modelValue.value.companyId = newValue.clientDetails.id
  }
}

const includeTax = ref(true)

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
    if (defaultLocale !== void 0 && defaultLocale !== null)
      modelValue.value.locale = defaultLocale

    const defaultCurrency = filteredCompanies.value.find(
      (company) => company.id === newVal
    )?.defaultCurrency
    if (defaultCurrency !== void 0 && defaultCurrency !== null)
      modelValue.value.currency = defaultCurrency

    const defaultIncludeTax = filteredCompanies.value.find(
      (company) => company.id === newVal
    )?.defaultIncludeTax
    if (defaultIncludeTax !== void 0) includeTax.value = defaultIncludeTax
  }
)

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
      },
      projectId: modelValue.value.projectId
    })
  }
  return ''
})

const currencySymbols = ref({
  EUR: '€',
  USD: '$'
})

const updateClientFormRef = ref<typeof ClientForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateClientDialog = async () => {
  const data = modelValue.value.clientDetails
  updateDialogRef.value?.functions.open()

  await until(updateClientFormRef).toBeTruthy()

  updateClientFormRef.value?.functions.setValue(data)
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
        persistent: true,
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
