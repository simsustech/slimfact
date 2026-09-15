<template>
  <responsive-dialog
    ref="dialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
    persistent
    @submit="link"
  >
    <template #title>
      <div class="row items-center q-gutter-sm">
        <span>{{ title }}</span>
        <q-badge
          v-if="scoreLabel"
          color="primary"
          outline
          data-testid="dialog-score"
        >
          {{ scoreLabel }}
        </q-badge>
      </div>
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
          v-for="invoice in sortedInvoices"
          :key="invoice.id"
          clickable
          @click="selectedId = invoice.id"
        >
          <q-item-section>
            <invoice-expansion-item :model-value="invoice">
              <template #item-avatar>
                <q-checkbox
                  :model-value="selectedId === invoice.id"
                  data-testid="invoice-select"
                  @update:model-value="
                    (checked: boolean) => {
                      if (checked) selectedId = invoice.id
                    }
                  "
                />
              </template>
              <template #item-side>
                <q-badge
                  v-if="adoptableIds.has(invoice.id)"
                  color="positive"
                  :label="lang.payment.suggestions?.adoptBadge ?? 'Adopt'"
                />
                <q-badge
                  v-if="scoreById.has(invoice.id)"
                  :color="scoreColor(scoreById.get(invoice.id)!)"
                  outline
                  data-testid="invoice-score"
                >
                  {{ Math.round(scoreById.get(invoice.id)! * 100) }}%
                </q-badge>
              </template>
            </invoice-expansion-item>
          </q-item-section>
        </q-item>
      </q-list>
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
import type { Invoice } from '@modular-api/fastify-checkout'
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
  candidateScores: Array<{
    invoiceId: number
    score: number
    adoptable: boolean
  }>
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

/** Green >= 80 %, amber >= 50 %, grey otherwise. */
const scoreColor = (score: number): string =>
  score >= 0.8 ? 'positive' : score >= 0.5 ? 'warning' : 'grey'

/** Match confidence of the preselected top suggestion (0–1). */
const topScore = computed(() => props.row?.topSuggestion?.score ?? null)
const scoreLabel = computed(() =>
  topScore.value == null ? '' : `${Math.round(topScore.value * 100)}%`
)

const invoices = ref<Invoice[]>([])
const loading = ref(false)
const selectedId = ref<number | null>(null)

const adoptableIds = computed(() => {
  const row = props.row
  if (!row) return new Set<number>()
  return new Set(row.adoptableInvoiceIds)
})

/** Per-invoice match confidence from the engine, keyed by invoice id. */
const scoreById = computed(() => {
  const row = props.row
  const map = new Map<number, number>()
  if (!row) return map
  for (const c of row.candidateScores ?? []) map.set(c.invoiceId, c.score)
  return map
})

/** Invoices ordered by match confidence (descending, unknown last). */
const sortedInvoices = computed(() =>
  [...invoices.value].sort((a, b) => {
    const sa = scoreById.value.get(a.id) ?? -1
    const sb = scoreById.value.get(b.id) ?? -1
    return sb - sa
  })
)

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
      const result = await trpc.admin.getInvoices.query({
        companyId: row.companyId ?? 0,
        clientId: 0,
        clientDetails: { name: null },
        pagination: { limit: 200, offset: 0, sortBy: 'id', descending: false },
        uuids: row.candidateInvoiceUuids
      })
      invoices.value = (result ?? []) as Invoice[]
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
