<template>
  <responsive-dialog
    ref="dialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
    persistent
    @submit="link"
  >
    <template #title>
      {{ title }}
    </template>

    <div v-if="loading" class="q-pa-md text-center">
      <q-spinner />
    </div>

    <div v-else-if="invoices.length === 0" class="text-grey-7 q-pa-md">
      {{ lang.bank.linkDialog.noCandidates }}
    </div>

    <template v-else>
      <q-list dense>
        <q-item
          v-for="invoice in invoices"
          :key="invoice.id"
          clickable
          @click="selectedId = invoice.id"
        >
          <q-item-section side>
            <q-radio
              :model-value="selectedId"
              :val="invoice.id"
              @update:model-value="
                (v: number | null) => {
                  if (v != null) selectedId = v
                }
              "
            />
          </q-item-section>
          <q-item-section>
            <invoice-expansion-item
              :model-value="invoice"
              selectable
              :selected="selectedId === invoice.id"
              :adoptable="adoptableIds.has(invoice.id)"
              @update:selected="
                (sel: boolean) => {
                  if (sel) selectedId = invoice.id
                }
              "
            />
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <template #actions>
      <q-btn flat :label="lang.bank.linkDialog.cancel" @click="done(false)" />
      <q-btn
        type="submit"
        color="primary"
        :label="lang.bank.linkDialog.confirm"
        :disable="selectedId === null || loading"
      />
    </template>
  </responsive-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { ResponsiveDialog } from '@simsustech/quasar-components'
import { useLang } from '../../../lang/index.js'
import { isTRPCClientError } from '../../../trpc.js'
import { useAdminApplyLinkMutation } from '../../../queries/admin/bankTransactions.js'
import InvoiceExpansionItem from '../../../components/invoice/InvoiceExpansionItem.vue'
import { formatMoney } from '../../../utils/money.js'
import { trpc } from '../../../trpc.js'

type SuggestionRow = {
  transaction: {
    externalId: string
    accountExternalId: string
    companyId: number
    amountCents: number
    currency: string
    creditDebit: string
    status: string | null
    bookingDate: string | null
    description: string | null
    remittanceInformation: string | null
    referenceNumber: string | null
    counterpartyName: string | null
    counterpartyIban: string | null
  }
  companyId: number | null
  topSuggestion: {
    invoiceId: number
    invoiceNumber: string | null
    score: number
  } | null
  candidateInvoiceUuids: string[]
  adoptableInvoiceIds: number[]
}

const props = defineProps<{
  row: SuggestionRow | null
}>()
const emit = defineEmits<{ linked: [] }>()

const lang = useLang()
const $q = useQuasar()

const dialogRef = ref<InstanceType<typeof ResponsiveDialog>>()
const functions = { open: () => dialogRef.value?.functions.open() }
defineExpose({ functions })

const { mutateAsync: applyLink } = useAdminApplyLinkMutation()

const title = computed(() => {
  const row = props.row
  if (!row) return ''
  return `${formatMoney(row.transaction.amountCents, row.transaction.currency)} · ${
    row.transaction.bookingDate ?? ''
  }`
})

const invoices = ref<
  Array<{
    id: number
    uuid: string
    number: string | null
    amountDueCents: number
    currency: string
    status: string
    companyId: number | null
    dueDate: string | null
    numberPrefix: string | null
    companyPrefix: string
    totalIncludingTax: number
    totalExcludingTax: number
    clientId: number | null
    clientDetails: {
      name: string | null
      address: string
      postalCode: string
      city: string
      country: string
      email: string
    }
    taxSummary: unknown[]
    lines: unknown[]
    paidAt: string | null
    createdAt: string
  }>
>([])
const loading = ref(false)
const selectedId = ref<number | null>(null)

const adoptableIds = computed(() => {
  const row = props.row
  if (!row) return new Set<number>()
  return new Set(row.adoptableInvoiceIds)
})

// Fetch invoices when dialog opens
watch(
  () => props.row,
  async (row) => {
    if (!row || row.candidateInvoiceUuids.length === 0) {
      invoices.value = []
      selectedId.value = null
      return
    }
    loading.value = true
    try {
      const result = (await trpc.admin.getInvoices.query({
        companyId: row.companyId ?? 0,
        clientId: 0,
        clientDetails: { name: null },
        pagination: { limit: 200, offset: 0, sortBy: 'id', descending: false },
        uuids: row.candidateInvoiceUuids
      })) as Array<{
        id: number
        uuid: string
        number: string | null
        amountDueCents: number
        currency: string
        status: string
        companyId: number | null
        dueDate: string | null
        numberPrefix: string | null
        companyPrefix: string
        totalIncludingTax: number
        totalExcludingTax: number
        clientId: number | null
        clientDetails: {
          name: string | null
          address: string
          postalCode: string
          city: string
          country: string
          email: string
        }
        taxSummary: unknown[]
        lines: unknown[]
        paidAt: string | null
        createdAt: string
      }>
      invoices.value = result ?? []
      // Auto-select top suggestion if present
      if (row.topSuggestion) {
        selectedId.value = row.topSuggestion.invoiceId
      }
    } catch (e) {
      console.error(e)
      $q.notify({ type: 'negative', message: lang.value.bank.actionFailed })
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)

const link: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const row = props.row
  if (!row || selectedId.value === null) return done(false)
  try {
    await applyLink({
      mode: 'direct',
      accountExternalId: row.transaction.accountExternalId,
      transactionExternalId: row.transaction.externalId,
      invoiceIds: [selectedId.value]
    })
    emit('linked')
    done(true)
  } catch (e) {
    console.error(e)
    $q.notify({
      type: 'negative',
      message: lang.value.bank.actionFailed,
      caption: isTRPCClientError(e)
        ? e.message
        : e instanceof Error
          ? e.message
          : String(e)
    })
    done(false)
  }
}
</script>
