import { EventBus } from '@modular-api/event-bus'
import type { EventBusClient } from '@modular-api/event-bus/client'
import { bankEventSchemas } from '@slimfact/banking-api/events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventMessage } from '@modular-api/event-bus'

const setEnv = () => {
  process.env.API_HOST = 'slimfact.test'
  process.env.OTP_SECRET = 'test-otp-secret'
  process.env.OIDC_CLIENT_SECRET = 'test-client-secret'
  process.env.OIDC_COOKIES_KEYS = 'test-cookie-keys'
  process.env.BANKING_API_KEY = 'obk_test_key'
  process.env.BANKING_API_URL = 'http://banking-api'
}

const makeMessage = (
  topic: string,
  data: Record<string, unknown>
): EventMessage => ({
  topic,
  data,
  publishedAt: new Date().toISOString()
})

// bank.sync.finished requires the count fields — the bus validates payloads.
const finishedData = (runId: string) => ({
  runId,
  status: 'finished' as const,
  accountsSynced: 1,
  accountsSkippedReauth: 0,
  newTransactions: 2
})

describe('banking relay hub', () => {
  const envBackup = { ...process.env }
  let startRelay: (typeof import('../../../src/banking/events.js'))['startRelay']
  let resetRelay: (typeof import('../../../src/banking/events.js'))['resetRelay']
  let createOidcAuthenticate: (typeof import('../../../src/banking/events.js'))['createOidcAuthenticate']
  let localBus: EventBus<typeof bankEventSchemas>
  let capturedHandler: ((message: EventMessage) => void) | null
  let fakeProxy: EventBusClient

  beforeEach(() => {
    vi.resetModules()
    setEnv()
    capturedHandler = null
    fakeProxy = {
      subscribe: vi.fn(
        (_glob: string, handler: (message: EventMessage) => void) => {
          capturedHandler = handler
          return () => {}
        }
      ),
      publish: vi.fn(),
      close: vi.fn(async () => {})
    } as unknown as EventBusClient
    localBus = new EventBus(bankEventSchemas)
  })

  afterEach(() => {
    vi.resetModules()
    process.env = { ...envBackup }
  })

  const load = async () => {
    const events = await import('../../../src/banking/events.js')
    startRelay = events.startRelay
    resetRelay = events.resetRelay
    createOidcAuthenticate = events.createOidcAuthenticate
  }

  const makeFastify = (getClient = () => null) =>
    ({
      eventBus: { bus: localBus },
      banking: { getClient },
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
    }) as never

  it('re-publishes proxy bank.* events on the local eventBus', async () => {
    await load()
    resetRelay()
    const received: EventMessage[] = []
    localBus.subscribe('bank.**', (message) => received.push(message))

    const relay = await startRelay({
      fastify: makeFastify(),
      proxyClient: fakeProxy
    })
    capturedHandler?.(makeMessage('bank.sync.finished', finishedData('r1')))

    expect(received).toHaveLength(1)
    expect(received[0]!.topic).toBe('bank.sync.finished')
    expect(received[0]!.data).toMatchObject({ runId: 'r1' })
    expect(fakeProxy.subscribe).toHaveBeenCalledWith(
      'bank.**',
      expect.any(Function)
    )
    relay.close()
  })

  it('waitForSyncRun resolves on bank.sync.finished for the matching runId', async () => {
    await load()
    resetRelay()
    const relay = await startRelay({
      fastify: makeFastify(),
      proxyClient: fakeProxy
    })

    const waiting = relay.waitForSyncRun('run-1', 2000)
    capturedHandler?.(makeMessage('bank.sync.started', { runId: 'run-1' }))
    capturedHandler?.(makeMessage('bank.sync.finished', finishedData('run-1')))

    await expect(waiting).resolves.toBe('finished')
    relay.close()
  })

  it('waitForSyncRun ignores stale runs and falls back to getSyncStatus on timeout', async () => {
    await load()
    resetRelay()
    const getClient = () =>
      ({
        getSyncStatus: vi.fn(async () => ({
          status: 'finished',
          runId: 'latest'
        }))
      }) as never
    const relay = await startRelay({
      fastify: makeFastify(getClient),
      proxyClient: fakeProxy
    })

    const waiting = relay.waitForSyncRun('run-2', 50)
    // a different run finishes — must not resolve the waiter
    capturedHandler?.(makeMessage('bank.sync.finished', finishedData('other')))

    await expect(waiting).resolves.toBe('finished')
    relay.close()
  })

  it('waitForSyncRun resolves timeout when the proxy has no completing run', async () => {
    await load()
    resetRelay()
    const getClient = () =>
      ({ getSyncStatus: vi.fn(async () => ({ status: 'idle' })) }) as never
    const relay = await startRelay({
      fastify: makeFastify(getClient),
      proxyClient: fakeProxy
    })

    await expect(relay.waitForSyncRun('run-3', 50)).resolves.toBe('timeout')
    relay.close()
  })

  it('OIDC authenticate resolves the identity from connectionParams.token', async () => {
    await load()
    const fastify = {
      oidc: {
        AccessToken: {
          find: vi.fn(async () => ({
            accountId: 'acc-1',
            sessionUid: 'sess-1'
          }))
        }
      },
      accountMethods: {
        findById: vi.fn(async () => ({ id: 'acc-1', roles: ['administrator'] }))
      }
    }
    const identity = await createOidcAuthenticate(fastify as never)({
      connectionParams: { token: 'the-token' }
    })
    expect(identity).toMatchObject({ id: 'acc-1' })
    expect(fastify.oidc.AccessToken.find).toHaveBeenCalledWith('the-token')
  })

  it('OIDC authenticate throws on missing or invalid tokens', async () => {
    await load()
    const fastify = {
      oidc: {
        AccessToken: { find: vi.fn(async () => null) }
      },
      accountMethods: { findById: vi.fn(async () => null) }
    }
    const authenticate = createOidcAuthenticate(fastify as never)

    await expect(authenticate({ connectionParams: {} })).rejects.toThrow(
      /Missing access token/
    )
    await expect(
      authenticate({ connectionParams: { token: 'expired' } })
    ).rejects.toThrow(/Invalid access token/)
  })
})
