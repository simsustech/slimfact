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

    <!-- Settlement mode: settled PSP payout — read-only details -->
    <template v-if="isSettlement && settlement">
      <q-list dense>
        <q-item>
          <q-item-section>
            <q-item-label>
              {{ pspSettlementLabel(settlement.settlement.externalId) }}
            </q-item-label>
            <q-item-label caption>
              {{ settlementHeader }}
            </q-item-label>
            <q-item-label v-if="settlement.settlement.payoutDate" caption>
              {{ settlement.settlement.payoutDate }}
              <span v-if="settlement.settlement.status">
                · {{ settlement.settlement.status }}
              </span>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
      <div class="q-mt-sm">{{ lang.bank.linkedDocuments }}</div>
      <q-list dense>
        <q-item
          v-for="payment in settlementPayments"
          :key="payment.paymentExternalId"
        >
          <q-item-section side>
            <q-icon name="i-mdi-check_circle" color="positive" size="sm" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ payment.invoiceNumber }} ·
              {{
                formatCents(
                  payment.amountCents,
                  settlement?.settlement.currency
                )
              }}
              <q-btn
                v-if="payment.invoiceUuid"
                flat
                :to="'/admin/invoices/' + payment.invoiceUuid"
              >
                → {{ payment.invoiceNumber }}
              </q-btn>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
      <div v-if="unlinkedPayments.length > 0" class="q-mt-sm">
        {{ lang.bank.unlinkedTransactions }}
      </div>
      <q-list v-if="unlinkedPayments.length > 0" dense>
        <q-item
          v-for="payment in unlinkedPayments"
          :key="payment.paymentExternalId"
        >
          <q-item-section>
            <q-item-label>
              {{ payment.paymentExternalId }}
              <span class="text-grey">
                {{
                  formatCents(
                    payment.amountCents,
                    settlement?.settlement.currency
                  )
                }}
              </span>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <!-- Link mode -->
    <template v-else>
      <!-- Adopt: single paid invoice — checkbox row + note -->
      <template
        v-if="
          row &&
          row.suggestion &&
          row.suggestion.type === 'single' &&
          row.suggestion.invoice.status !== 'OPEN'
        "
      >
        <q-list dense>
          <q-item>
            <q-item-section side>
              <q-checkbox
                :model-value="selectedIds.has(row.suggestion.invoice.id)"
                :aria-label="row.suggestion.invoice.number ?? ''"
                @update:model-value="toggleCandidate(row.suggestion.invoice.id)"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{ invoiceLabel(row.suggestion.invoice) }}
              </q-item-label>
              <q-item-label caption>
                {{ lang.bank.adoptNote }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </template>

      <!-- Manual picker: single/multi/split/no-proposal -->
      <template v-else>
        <div v-if="candidates.length === 0" class="text-grey-7 q-pa-md">
          {{ lang.bank.linkDialog.noCandidates }}
        </div>
        <template v-else>
          <div class="text-grey-7 q-mb-sm">
            {{ lang.bank.linkDialog.selectInvoices }}
          </div>
          <q-list dense>
            <q-item v-for="candidate in candidates" :key="candidate.id">
              <q-item-section side>
                <q-checkbox
                  :model-value="selectedIds.has(candidate.id)"
                  :aria-label="candidate.number ?? ''"
                  @update:model-value="toggleCandidate(candidate.id)"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ candidate.number ?? '' }} ·
                  {{
                    formatCents(candidate.amountDueCents, candidate.currency)
                  }}
                </q-item-label>
                <q-item-label
                  caption
                  :class="{ 'text-positive': fitsRemaining(candidate) }"
                >
                  {{ formatDate(candidate.dueDate) }}
                  <span v-if="fitsRemaining(candidate)"> · ✓</span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <!-- Sum bar -->
          <div class="q-mt-sm row items-center">
            <q-icon
              :name="matchExact ? 'i-mdi-check-circle' : 'i-mdi-close-circle'"
              :color="matchExact ? 'positive' : 'negative'"
              size="sm"
              class="q-mr-xs"
            />
            <span :class="matchExact ? 'text-positive' : 'text-negative'">
              {{ matchLabel }}
            </span>
          </div>
        </template>
      </template>
    </template>

    <template #actions>
      <q-btn flat :label="lang.bank.linkDialog.cancel" @click="done(false)" />
      <q-btn
        v-if="!isSettlement"
        type="submit"
        color="primary"
        :label="lang.bank.linkDialog.confirm"
        :disable="!canSubmit"
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
import {
  useAdminApplyLinkMutation,
  useAdminListLinkCandidatesQuery
} from '../../../queries/admin/bankTransactions.js'
import type {
  OverviewRow,
  ProposalInvoice
} from '../../../queries/admin/bankTransactions.js'
import { formatMoney } from '../../../utils/money.js'

const props = defineProps<{ row: OverviewRow | null }>()
const emit = defineEmits<{ linked: [] }>()

const lang = useLang()
const $q = useQuasar()

const dialogRef = ref<InstanceType<typeof ResponsiveDialog>>()
const functions = { open: () => dialogRef.value?.functions.open() }
defineExpose({ functions })

const { mutateAsync: applyLink } = useAdminApplyLinkMutation()
const { payload: candidates, setCompanyId } = useAdminListLinkCandidatesQuery()

const isSettlement = computed(() => props.row?.coverage === 'settled')
const settlement = computed(() =>
  isSettlement.value ? (props.row?.psp ?? null) : null
)
const settlementPayments = computed(() =>
  (settlement.value?.payments ?? []).filter(
    (payment) => payment.invoiceNumber != null
  )
)
const unlinkedPayments = computed(() =>
  (settlement.value?.payments ?? []).filter(
    (payment) => payment.invoiceNumber == null
  )
)

const title = computed(() => {
  const row = props.row
  if (!row) return ''
  if (row.coverage === 'settled') return lang.value.bank.settlementDetails
  return `${formatCents(row.transaction.amountCents, row.transaction.currency)} · ${
    row.transaction.bookingDate ?? ''
  }`
})

const invoiceLabel = (invoice: ProposalInvoice): string =>
  `${invoice.number ?? ''} · ${formatCents(invoice.amountDueCents, invoice.currency)}`

const formatCents = (cents: number, currency = 'EUR'): string =>
  formatMoney(cents, currency)

// date-fns is not a dependency of the app package; Intl.DateTimeFormat gives
// the same localized medium-date rendering without adding one.
const formatDate = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(value)
      )
    : ''

const pspSettlementLabel = (id: string): string =>
  lang.value.bank.linkDialog.pspSettlement.replace('{id}', id)

const settlementHeader = computed(() => {
  const s = settlement.value?.settlement
  if (!s) return ''
  const fee = lang.value.bank.linkDialog.fee.replace(
    '{amount}',
    formatCents(s.feeCents ?? 0, s.currency)
  )
  return `${s.psp.toUpperCase()} · ${formatCents(s.amountCents, s.currency)} · ${fee}`
})

// --- Manual picker state ---
const selectedIds = ref(new Set<number>())

const selectedTotal = computed(() => {
  const invoiceList = candidates.value ?? []
  let total = 0
  for (const id of selectedIds.value) {
    const inv = invoiceList.find((i) => i.id === id)
    if (inv) total += inv.amountDueCents
  }
  return total
})

const matchExact = computed(
  () => selectedTotal.value === props.row?.transaction.amountCents
)

/** What is left of the transaction amount after the current selection. */
const remainingAfterSelection = computed(
  () => (props.row?.transaction.amountCents ?? 0) - selectedTotal.value
)
/** Candidates whose due amount exactly fits the still-unassigned remainder. */
const fitsRemaining = (candidate: ProposalInvoice): boolean =>
  remainingAfterSelection.value > 0 &&
  candidate.amountDueCents === remainingAfterSelection.value

const matchLabel = computed(() => {
  const row = props.row
  const tx = row?.transaction.amountCents ?? 0
  const currency = row?.transaction.currency
  const diff = selectedTotal.value - tx
  if (diff === 0) return lang.value.bank.linkDialog.matchComplete
  if (diff > 0)
    return lang.value.bank.linkDialog.matchOver.replace(
      '{amount}',
      formatCents(diff, currency)
    )
  return lang.value.bank.linkDialog.matchDifference.replace(
    '{amount}',
    formatCents(-diff, currency)
  )
})

const canSubmit = computed(() => {
  const row = props.row
  const suggestion = row?.suggestion
  // Adopt: the preselected paid invoice is not in the OPEN-only candidates,
  // so it needs an explicit branch to enable submit.
  if (
    suggestion?.type === 'single' &&
    suggestion.invoice.status !== 'OPEN' &&
    selectedIds.value.has(suggestion.invoice.id)
  ) {
    return true
  }
  if (matchExact.value) return true
  if (selectedIds.value.size === 1) {
    const id = [...selectedIds.value][0]
    const inv = (candidates.value ?? []).find((i) => i.id === id)
    return (
      inv !== undefined &&
      inv.amountDueCents > (props.row?.transaction.amountCents ?? 0)
    )
  }
  return false
})

const toggleCandidate = (id: number) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

// Preselect from proposal when row opens
watch(
  () => props.row,
  (row) => {
    if (!row) {
      selectedIds.value = new Set()
      setCompanyId(null)
      return
    }
    const companyId =
      row.suggestion?.type === 'multi'
        ? (row.suggestion.invoices[0]?.companyId ?? null)
        : row.suggestion?.type === 'split' || row.suggestion?.type === 'single'
          ? row.suggestion.invoice.companyId
          : null
    setCompanyId(companyId ?? row.companyId)
    // Preselect from proposal
    const next = new Set<number>()
    if (row.suggestion?.type === 'multi') {
      for (const inv of row.suggestion.invoices) next.add(inv.id)
    } else if (row.suggestion?.type === 'split') {
      next.add(row.suggestion.invoice.id)
    } else if (row.suggestion?.type === 'single') {
      next.add(row.suggestion.invoice.id)
    }
    selectedIds.value = next
  },
  { immediate: true }
)

const link: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const row = props.row
  if (!row || isSettlement.value) return done(false)
  try {
    if (selectedIds.value.size > 0) {
      await applyLink({
        mode: 'direct',
        accountExternalId: row.transaction.accountExternalId,
        transactionExternalId: row.transaction.externalId,
        invoiceIds: [...selectedIds.value]
      })
    } else {
      return done(false)
    }
    emit('linked')
    done(true)
  } catch (e) {
    console.error(e)
    // Surface the server error and keep the dialog open so the user's
    // selections are preserved.
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
