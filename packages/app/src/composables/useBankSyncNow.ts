import { ref } from 'vue'
import type { BankSyncEvent } from '../queries/admin/bankTransactions.js'

export type BankSyncNowState = 'idle' | 'loading' | 'done' | 'requested'

/**
 * Outcome of the last sync request. `requested` carries a lang key so the
 * consumer can show a localized message; `error` carries the raw error so
 * the consumer decides how to present it (never `String(error)`).
 */
export type BankSyncResult =
  | { kind: 'requested'; messageKey: string }
  | { kind: 'error'; error: unknown }

export interface UseBankSyncNowOptions {
  /** Refetch the bank queries once the sync run is done / requested. */
  invalidate: () => Promise<void> | void
  /** Bound for waiting on the `bank.sync.finished` event. Default 120s. */
  waitMs?: number
  /** Injectable for tests. Default: `trpc.admin.requestSync.mutate()`. */
  requestSync?: () => Promise<{ queued: boolean; runId: string }>
  /** Injectable for tests. Default: the backend event-bus subscription. */
  subscribe?: (handler: (event: BankSyncEvent) => void) => () => void
}

/**
 * Sync-now state machine (D15): click → loading → the queued proxy sync runs →
 * `bank.sync.finished {runId}` arrives over WS → done + invalidate. A bounded
 * wait falls back to `requested` so the button never hangs.
 */
export const useBankSyncNow = (options: UseBankSyncNowOptions) => {
  const state = ref<BankSyncNowState>('idle')
  const syncResult = ref<BankSyncResult | null>(null)
  const waitMs = options.waitMs ?? 120_000

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined

  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = undefined
    unsubscribe?.()
    unsubscribe = undefined
  }

  const syncNow = async () => {
    cleanup()
    state.value = 'loading'
    syncResult.value = null

    try {
      const { runId } = options.requestSync
        ? await options.requestSync()
        : await import('../trpc.js').then((m) =>
            m.trpc.admin.requestSync.mutate()
          )

      const subscribeFn =
        options.subscribe ??
        (async (handler: (event: BankSyncEvent) => void) => {
          const queries = await import('../queries/admin/bankTransactions.js')
          return queries.subscribeToBankSyncEvents(handler)
        })
      unsubscribe = await subscribeFn((event) => {
        if (
          event.topic === 'bank.sync.finished' &&
          event.data.runId === runId
        ) {
          cleanup()
          state.value = 'done'
          void options.invalidate()
        }
      })

      timeoutId = setTimeout(() => {
        if (state.value !== 'loading') return
        cleanup()
        state.value = 'requested'
        syncResult.value = {
          kind: 'requested',
          messageKey: 'bank.syncRequested'
        }
        void options.invalidate()
      }, waitMs)
    } catch (error) {
      cleanup()
      state.value = 'idle'
      syncResult.value = { kind: 'error', error }
    }
  }

  return { state, syncResult, syncNow }
}
