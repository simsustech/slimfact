<template>
  <q-page padding>
    <div class="grid grid-cols-12 gap-3">
      <company-select
        v-if="filteredCompanies"
        v-model="companyId"
        class="md:col-span-4 col-span-12"
        :filtered-options="filteredCompanies"
        required
        @filter="onFilterCompanies"
      />
      <date-input
        v-model="startDate"
        :label="lang.subscription.fields.startDate"
        format="DD-MM-YYYY"
        clearable
        required
        class="md:col-span-4 col-span-12"
        :date="{
          noUnset: true,
          defaultView: 'Years',
          firstDayOfWeek: '1'
        }"
        :icons="{
          event: 'i-mdi-event',
          clear: 'i-mdi-clear'
        }"
      />
      <date-input
        v-model="endDate"
        :label="lang.subscription.fields.endDate"
        format="DD-MM-YYYY"
        clearable
        class="md:col-span-4 col-span-12"
        :date="{
          noUnset: true,
          defaultView: 'Years',
          firstDayOfWeek: '1'
        }"
        :icons="{
          event: 'i-mdi-event',
          clear: 'i-mdi-clear'
        }"
      />
    </div>
    <q-list>
      <q-item>
        <q-item-section> DigiBoox </q-item-section>
        <q-item-section side>
          <q-btn icon="i-mdi-download" @click="downloadDigibooxInvoices" />
        </q-item-section>
      </q-item>
    </q-list>
  </q-page>
</template>

<script setup lang="ts">
import { date as dateUtil, exportFile } from 'quasar'
import { onMounted, ref } from 'vue'
import CompanySelect from '../../components/company/CompanySelect.vue'
import InvoiceForm from 'src/components/invoice/InvoiceForm.vue'
import { DateInput } from '@simsustech/quasar-components/form'
import { useQuery } from '@pinia/colada'
import { trpc } from '../../trpc.js'
import { useAdminSearchCompaniesQuery } from 'src/queries/admin/companies'
import { useLang } from '../../lang/index.js'

const lang = useLang()
const companyId = ref<number>()
const endDate = ref(new Date().toISOString().slice(0, 10))
const startDate = ref(
  dateUtil
    .subtractFromDate(new Date(endDate.value), {
      months: 1
    })
    .toISOString()
    .slice(0, 10)
)

const { data: digibooxCsv, refetch: executeDigibooxInvoices } = useQuery({
  enabled:
    !import.meta.env.SSR &&
    !!companyId.value &&
    !!startDate.value &&
    !!endDate.value,
  key: () => [
    'adminExportDigibooxInvoices',
    companyId.value!,
    startDate.value,
    endDate.value
  ],
  query: () =>
    trpc.admin.exportDigibooxInvoices.query({
      companyId: companyId.value!,
      startDate: startDate.value,
      endDate: endDate.value
    })
})

// const { data: digibooxCsv, execute: executeDigibooxInvoices } = useQuery(
//   'admin.exportDigibooxInvoices',
//   {
//     args: reactive({
//       companyId,
//       startDate,
//       endDate
//     }),
//     reactive: false
//   }
// )

const downloadDigibooxInvoices = async () => {
  await executeDigibooxInvoices()
  if (digibooxCsv.value) exportFile('digiboox.csv', digibooxCsv.value)
}

const {
  companies: filteredCompanies,
  searchPhrase: companiesSearchPhrase,
  refetch: refetchFilteredCompanies
} = useAdminSearchCompaniesQuery()

const onFilterCompanies: InstanceType<
  typeof InvoiceForm
>['$props']['onFilter:companies'] = async ({ searchPhrase, done }) => {
  companiesSearchPhrase.value = searchPhrase
  await refetchFilteredCompanies()

  if (done) done()
}

onMounted(async () => {
  await refetchFilteredCompanies()
})
</script>
