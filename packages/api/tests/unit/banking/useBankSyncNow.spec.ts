import { describe, expect, it, vi } from 'vitest'
import { useBankSyncNow } from '@slimfact/app/src/composables/useBankSyncNow.js'
import { buildTrpcLinks } from '@slimfact/app/src/trpcLinks.js'
import type { TRPCLink } from '@trpc/client'

const { createWSClientMock } = vi.hoisted(() => ({
  createWSClientMock: vi.fn(() => ({ close: vi.fn(async () => {}) }))
}))

vi.mock('@trpc/client', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return { ...actual, createWSClient: createWSClientMock }
})

type SyncEvent = {
  topic: string
  data: { runId: string } & Record<string, unknown>
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useBankSyncNow', () => {
  it('goes loading on click, then done + invalidate on the matching finished event', async () => {
    let handler: ((event: SyncEvent) => void) | null = null
    const unsubscribe = vi.fn()
    const invalidate = vi.fn(async () => {})
    const { state, syncNow } = useBankSyncNow({
      invalidate,
      waitMs: 1000,
      requestSync: vi.fn(async () => ({ queued: true, runId: 'run-1' })),
      subscribe: vi.fn((h) => {
        handler = h
        return unsubscribe
      })
    })

    const promise = syncNow()
    await delay(10)
    expect(state.value).toBe('loading')

    handler!({ topic: 'bank.sync.finished', data: { runId: 'run-1' } })
    await promise

    expect(state.value).toBe('done')
    expect(invalidate).toHaveBeenCalled()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('ignores finished events for other runIds', async () => {
    let handler: ((event: SyncEvent) => void) | null = null
    const invalidate = vi.fn()
    const { state, syncNow } = useBankSyncNow({
      invalidate,
      waitMs: 50,
      requestSync: vi.fn(async () => ({ queued: true, runId: 'run-1' })),
      subscribe: vi.fn((h) => {
        handler = h
        return () => {}
      })
    })
    const promise = syncNow()
    await delay(10)
    handler!({ topic: 'bank.sync.finished', data: { runId: 'other' } })
    expect(state.value).toBe('loading')
    await promise
    await delay(80) // waitMs = 50 → the timeout fires after
    expect(state.value).toBe('requested') // timed out, never finished
  })

  it('falls back to requested when the event never arrives', async () => {
    const invalidate = vi.fn()
    const { state, syncResult, syncNow } = useBankSyncNow({
      invalidate,
      waitMs: 20,
      requestSync: vi.fn(async () => ({ queued: true, runId: 'run-2' })),
      subscribe: vi.fn(() => vi.fn())
    })

    await syncNow()
    await delay(40) // waitMs = 20 → the timeout fires after

    expect(state.value).toBe('requested')
    expect(syncResult.value).toEqual({
      kind: 'requested',
      messageKey: 'bank.syncRequested'
    })
    expect(invalidate).toHaveBeenCalled()
  })

  it('returns to idle on request error', async () => {
    const failure = new Error('no sync scope')
    const { state, syncResult, syncNow } = useBankSyncNow({
      invalidate: vi.fn(),
      requestSync: vi.fn(async () => {
        throw failure
      })
    })

    await syncNow()

    expect(state.value).toBe('idle')
    expect(syncResult.value).toEqual({ kind: 'error', error: failure })
  })
})

describe('buildTrpcLinks', () => {
  const httpLink = {} as TRPCLink<never>

  it('attaches only the http link on the server (no wsLink)', () => {
    const links = buildTrpcLinks({
      wsUrl: 'wss://api.example.test/ws',
      getToken: () => 'server-token',
      httpLink,
      isBrowser: false
    })
    expect(links).toHaveLength(1)
    expect(links[0]).toBe(httpLink)
  })

  it('attaches the wsLink client-side and puts the token in connectionParams', () => {
    createWSClientMock.mockClear()
    buildTrpcLinks({
      wsUrl: 'wss://api.example.test/ws',
      getToken: () => 'browser-token',
      httpLink,
      isBrowser: true
    })
    expect(createWSClientMock).toHaveBeenCalledTimes(1)
    const callArgs = createWSClientMock.mock.calls[0] as unknown as [object]
    const options = callArgs[0] as unknown as {
      connectionParams?: () => { token: string }
    }
    expect(options.connectionParams?.()).toEqual({ token: 'browser-token' })
  })
})
