import { defineQuery, useMutation, useQuery } from '@pinia/colada'
import { trpc } from '../../trpc.js'
import { computed, ref, type Ref } from 'vue'
import type { BankAccount, OverviewRow } from '@slimfact/tools/banking'

// Wire-level bank types are shared with the api via @slimfact/tools/banking;
// re-export them so existing component imports keep working.
export type {
  ApplyResult,
  BankAccount,
  Coverage,
  LinkProposal,
  OverviewRow,
  PspPayoutDetail,
  PspSettlement,
  ProposalInvoice
} from '@slimfact/tools/banking'

export type BankTransaction = OverviewRow['transaction']

export type BankConnection = {
  sessionId: string
  aspspName: string
  aspspCountry: string
  status: string
  validUntil: string | null
  accountCount: number
  lastSyncedAt: string | null
  psuType: string | null
}

export type BankConnectionsPayload = {
  enabled: boolean
  connections: BankConnection[]
}

export type AvailableAccount = BankAccount & {
  /** Explicitly linked company ids (many-to-many; empty = IBAN fallback). */
  companyIds: number[]
  companyName: string | null
}

export const useAdminListBankTransactionsQuery = (
  companyIds: Ref<number[]>,
  linked?: Ref<'linked' | 'unlinked' | 'settled' | undefined>,
  suggestionsOnly?: Ref<boolean>,
  from?: Ref<string | undefined>,
  to?: Ref<string | undefined>
) => {
  const { data: payload, ...rest } = useQuery<{
    enabled: boolean
    items: OverviewRow[]
  }>({
    enabled: !import.meta.env.SSR,
    key: () => [
      'adminListBankTransactions',
      companyIds.value,
      linked?.value ?? null,
      suggestionsOnly?.value ?? false,
      from?.value ?? null,
      to?.value ?? null
    ],
    query: () =>
      trpc.admin.listTransactions.query({
        ...(companyIds.value.length ? { companyIds: companyIds.value } : {}),
        ...(linked?.value === undefined ? {} : { linked: linked.value }),
        ...(suggestionsOnly?.value ? { suggestionsOnly: true } : {}),
        ...(from?.value ? { from: from.value } : {}),
        ...(to?.value ? { to: to.value } : {})
      })
  })
  return { payload, ...rest }
}

export const useAdminListSuggestionsQuery = (
  from?: Ref<string | undefined>,
  to?: Ref<string | undefined>
) => {
  const { data: payload, ...rest } = useQuery<{
    enabled: boolean
    count: number
    items: Array<{
      transaction: BankTransaction
      companyId: number | null
      topSuggestion: {
        invoiceId: number
        invoiceNumber: string | null
        score: number
        evidence: {
          numRefHit: boolean
          clientScore: number
          adoptablePaymentId: number | null
        }
      } | null
      candidateInvoiceUuids: string[]
      adoptableInvoiceIds: number[]
      candidateScores: Array<{
        invoiceId: number
        score: number
        adoptable: boolean
      }>
    }>
  }>({
    enabled: !import.meta.env.SSR,
    key: () => ['adminListSuggestions', from?.value ?? null, to?.value ?? null],
    query: () =>
      trpc.admin.listSuggestions.query({
        ...(from?.value ? { from: from.value } : {}),
        ...(to?.value ? { to: to.value } : {})
      })
  })
  return { payload, ...rest }
}

/**
 * Shared actionable-suggestion count for nav badges (drawer, dashboard menu,
 * Payments tab). Singleton (defineQuery) so all consumers share one fetch +
 * cache and refresh together. Fetches with limit 1 — the server still computes
 * every suggestion, but we only ship the count.
 */
export const useAdminSuggestionCountQuery = defineQuery(() => {
  const { data, ...rest } = useQuery<{
    enabled: boolean
    count: number
    items: unknown[]
  }>({
    enabled: !import.meta.env.SSR,
    key: () => ['adminSuggestionCount'],
    query: () =>
      trpc.admin.listSuggestions.query({
        limit: 1,
        offset: 0
      })
  })

  const count = computed(() =>
    data.value?.enabled ? (data.value.count ?? 0) : 0
  )

  return {
    count,
    /** True once a real (non-cached) value is known. */
    known: computed(() => data.value != null),
    ...rest
  }
})

export const useAdminListLinkCandidatesQuery = defineQuery(() => {
  const companyId = ref<number | null>(null)
  const { data: payload, ...rest } = useQuery({
    enabled: computed(() => !import.meta.env.SSR && companyId.value !== null),
    key: () => ['adminListLinkCandidates', companyId.value],
    query: () =>
      trpc.admin.listLinkCandidates.query({ companyId: companyId.value! })
  })
  return {
    payload,
    ...rest,
    companyId,
    setCompanyId: (id: number | null) => {
      companyId.value = id
    }
  }
})
export const useAdminGetBankConnectionsQuery = defineQuery(() => {
  const { data: payload, ...rest } = useQuery({
    enabled: computed(() => !import.meta.env.SSR),
    key: () => ['adminBankConnections'],
    query: () => trpc.admin.getConnections.query()
  })
  return { payload, ...rest }
})

export const useAdminGetBankAvailableAccountsQuery = defineQuery(() => {
  const { data: payload, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => ['adminGetBankAvailableAccounts'],
    query: () => trpc.admin.getAvailableAccounts.query()
  })
  return { payload, ...rest }
})

export const useAdminApplyLinkMutation = () => {
  return useMutation({
    mutation: (input: {
      mode: 'direct'
      accountExternalId: string
      transactionExternalId: string
      invoiceIds: number[]
    }) => trpc.admin.applyLink.mutate(input)
  })
}

export const useAdminSetBankAccountCompaniesMutation = () => {
  return useMutation({
    mutation: (input: { accountExternalId: string; companyIds: number[] }) =>
      trpc.admin.setAccountCompanies.mutate(input)
  })
}

export const useAdminBankSyncNowMutation = () => {
  return useMutation({
    mutation: () => trpc.admin.requestSync.mutate()
  })
}

export const useAdminDismissSuggestionMutation = () => {
  return useMutation({
    mutation: (input: { transactionExternalId: string; companyId: number }) =>
      trpc.admin.dismissSuggestion.mutate(input)
  })
}
export type BankSyncEvent = {
  topic: string
  data: { runId: string } & Record<string, unknown>
}

/**
 * Subscribes to the backend's event bus (via the trpc wsLink) for
 * `bank.sync.*` events. Returns an unsubscribe function.
 */
export const subscribeToBankSyncEvents = (
  handler: (event: BankSyncEvent) => void
): (() => void) => {
  const subscription = trpc.subscribe.subscribe('bank.sync.*', {
    // SAFETY: tRPC subscription delivers JSON-parsed payloads matching the BankSyncEvent wire contract
    onData: (message) => handler(message as BankSyncEvent)
  })
  return () => subscription.unsubscribe()
}
