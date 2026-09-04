import { useMutation, useQuery } from '@pinia/colada'
import { computed, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { trpc } from '../../trpc.js'

export type PaymentsLedgerRow = Awaited<
  ReturnType<typeof trpc.admin.listPayments.query>
>['rows'][number]

export type PaymentsAggregates = Awaited<
  ReturnType<typeof trpc.admin.listPayments.query>
>['aggregates']

export interface PaymentsFilters {
  q: string
  from?: string
  to?: string
  methods: string[]
  statuses: string[]
  psps: string[]
  sources: Array<'payments' | 'refunds'>
}

export const DEFAULT_PAYMENTS_FILTERS: PaymentsFilters = {
  q: '',
  methods: [],
  statuses: [],
  psps: [],
  sources: ['payments', 'refunds']
}

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : ''
const asList = (value: unknown): string[] =>
  typeof value === 'string' && value.length > 0 ? value.split(',') : []

const toQueryParams = (filters: PaymentsFilters): Record<string, string> => {
  const params: Record<string, string> = {}
  if (filters.q) params.q = filters.q
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.methods.length) params.method = filters.methods.join(',')
  if (filters.statuses.length) params.status = filters.statuses.join(',')
  if (filters.psps.length) params.psp = filters.psps.join(',')
  if (
    filters.sources.length !== DEFAULT_PAYMENTS_FILTERS.sources.length ||
    filters.sources.some(
      (source) => !DEFAULT_PAYMENTS_FILTERS.sources.includes(source)
    )
  ) {
    params.source = filters.sources.join(',')
  }
  return params
}

const fromQueryParams = (query: Record<string, unknown>): PaymentsFilters => ({
  q: asString(query.q),
  from: asString(query.from) || undefined,
  to: asString(query.to) || undefined,
  methods: asList(query.method),
  statuses: asList(query.status),
  psps: asList(query.psp),
  sources: asList(query.source).filter(
    (source): source is PaymentsFilters['sources'][number] =>
      ['payments', 'refunds'].includes(source)
  )
})

/**
 * URL is the single source of truth for the ledger filters: the composable
 * mirrors route.query ⇄ reactive filters (arrays comma-encoded, search
 * debounced so keystrokes don't spam history).
 */
export const usePaymentsUrlState = () => {
  const route = useRoute()
  const router = useRouter()

  const filters = ref<PaymentsFilters>(
    fromQueryParams(route.query as Record<string, unknown>)
  )
  /** Immediate model for the search box; applied to filters after 300 ms. */
  const search = ref(filters.value.q)

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  watch(search, (value) => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (filters.value.q !== value)
        filters.value = { ...filters.value, q: value }
    }, 300)
  })

  // External navigation (back/forward, drawer deep-links) wins over local state.
  watch(
    () => route.query,
    (query) => {
      const next = fromQueryParams(query as Record<string, unknown>)
      if (JSON.stringify(next) !== JSON.stringify(filters.value)) {
        filters.value = next
        search.value = next.q
      }
    }
  )

  watch(
    filters,
    async (value) => {
      const params = toQueryParams(value)
      const current = route.query as Record<string, unknown>
      const changed = Object.keys({ ...current, ...params }).some(
        (key) => (current[key] ?? '') !== (params[key] ?? '')
      )
      if (changed) await router.replace({ query: params })
    },
    { deep: true }
  )

  const clear = () => {
    filters.value = { ...DEFAULT_PAYMENTS_FILTERS }
    search.value = ''
  }

  return { filters: filters as Ref<PaymentsFilters>, search, clear }
}

export const useAdminGetPaymentsQuery = (
  filters: Ref<PaymentsFilters>,
  page: Ref<{ limit: number; offset: number }>
) => {
  const { data: payload, ...rest } = useQuery({
    enabled: computed(() => !import.meta.env.SSR),
    key: () => [
      'adminGetPayments',
      JSON.stringify(filters.value),
      page.value.limit,
      page.value.offset
    ],
    query: () => {
      const value = filters.value
      return trpc.admin.listPayments.query({
        ...(value.q ? { q: value.q } : {}),
        ...(value.from ? { from: value.from } : {}),
        ...(value.to ? { to: value.to } : {}),
        ...(value.methods.length ? { methods: value.methods as never } : {}),
        ...(value.statuses.length ? { statuses: value.statuses } : {}),
        ...(value.psps.length ? { psps: value.psps } : {}),
        ...(value.sources.length ? { sources: value.sources } : {}),
        limit: page.value.limit,
        offset: page.value.offset
      })
    }
  })
  return { payload, ...rest }
}

export const useAdminExportPaymentsMutation = () => {
  return useMutation({
    mutation: (input: {
      q?: string
      from?: string
      to?: string
      methods?: string[]
      statuses?: string[]
      psps?: string[]
      sources?: Array<'payments' | 'refunds'>
    }) => trpc.admin.exportPayments.query(input as never)
  })
}
