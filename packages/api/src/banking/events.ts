import type { EventBus, EventMessage } from '@modular-api/event-bus'
import type { EventBusClient } from '@modular-api/event-bus/client'
import { createEventBusClient } from '@modular-api/event-bus/client'
import type { BankEventSchemas } from '@slimfact/banking-api/events'
import { appConfig } from '../config/env.js'
import type { BankingApi, SyncLogger } from './client.js'

export type RelayOutcome = 'finished' | 'failed' | 'timeout'

/** The slice of Fastify the relay + ingest worker need (test-friendly). */
export interface RelayFastify {
  banking: { getClient: () => BankingApi | null }
  eventBus: { bus: EventBus<BankEventSchemas> }
  log: SyncLogger
  checkout?: { invoiceHandler?: unknown }
  oidc?: {
    AccessToken: {
      find: (
        token: string
      ) => Promise<{ accountId?: string } | null | undefined>
    }
  }
  accountMethods?: {
    findById: (accountId: string) => Promise<unknown>
  }
}

export interface Relay {
  waitForSyncRun(runId: string, timeoutMs?: number): Promise<RelayOutcome>
  close(): void
}

export interface RelayOptions {
  fastify: RelayFastify
  /** Inject a fake proxy client for tests. */
  proxyClient?: EventBusClient
}

/**
 * OIDC authenticate hook for the local event bus: the browser sends its OAuth
 * access token as `connectionParams.token` (browsers cannot set WS headers).
 * Mirrors the HTTP context validation; throwing closes the socket.
 */
export const createOidcAuthenticate =
  (fastify: RelayFastify) =>
  async ({
    connectionParams
  }: {
    connectionParams?: unknown
  }): Promise<{ id: string; account: unknown }> => {
    const token = (connectionParams as { token?: string } | undefined)?.token
    if (!token) throw new Error('Missing access token')
    const accessToken = await fastify.oidc!.AccessToken.find(token)
    if (!accessToken?.accountId) throw new Error('Invalid access token')
    const account = (await fastify.accountMethods!.findById(
      accessToken.accountId
    )) as { id: string } | undefined | null
    if (!account?.id) throw new Error('Invalid access token')
    return { id: account.id, account }
  }

let activeRelay: Relay | null = null

const runIdOf = (message: EventMessage): string | undefined =>
  (message.data as { runId?: string }).runId

const waitForSyncRun = async ({
  fastify,
  runId,
  timeoutMs
}: {
  fastify: RelayFastify
  runId: string
  timeoutMs: number
}): Promise<RelayOutcome> => {
  const bus = fastify.eventBus.bus
  return new Promise<RelayOutcome>((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => {
      unsubFinished()
      unsubFailed()
      if (timer) clearTimeout(timer)
    }
    const settle = (outcome: RelayOutcome) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(outcome)
    }
    const unsubFinished = bus.subscribe('bank.sync.finished', (message) => {
      if (runIdOf(message) === runId) settle('finished')
    })
    const unsubFailed = bus.subscribe('bank.sync.failed', (message) => {
      if (runIdOf(message) === runId) settle('failed')
    })

    // Safety net: if the events never arrive (relay hiccup, reconnect), ask the
    // proxy directly so the caller never hangs.
    timer = setTimeout(async () => {
      let outcome: RelayOutcome = 'timeout'
      const client = fastify.banking.getClient()
      if (client) {
        try {
          const status = await client.getSyncStatus()
          if (
            status.status === 'finished' ||
            status.status === 'rate_limited'
          ) {
            outcome = 'finished'
          } else if (status.status === 'failed') {
            outcome = 'failed'
          }
        } catch {
          // keep timeout
        }
      }
      settle(outcome)
    }, timeoutMs)
  })
}

/**
 * The relay hub (singleton): subscribes to the proxy's event bus
 * (server-to-server, API-key header) and re-publishes every `bank.*` event on
 * the local `fastify.eventBus` so browsers can receive proxy events. Lazy
 * init; `waitForSyncRun` matches runIds and never hangs (getSyncStatus fallback).
 */
export const startRelay = async ({
  fastify,
  proxyClient
}: RelayOptions): Promise<Relay> => {
  if (activeRelay) return activeRelay

  const client =
    proxyClient ??
    createEventBusClient({
      url: appConfig.bankingApiUrl ?? '',
      wsHeaders: { authorization: `Bearer ${appConfig.bankingApiKey ?? ''}` }
    })

  const unsubscribe = client.subscribe('bank.**', (message) => {
    try {
      const bus = fastify.eventBus.bus as EventBus<BankEventSchemas> & {
        publish: (topic: string, data: unknown) => unknown
      }
      bus.publish(message.topic, message.data)
    } catch (error) {
      fastify.log.warn(
        `[relay] dropped proxy event ${message.topic}: ${String(error)}`
      )
    }
  })

  const relay: Relay = {
    waitForSyncRun: (runId, timeoutMs = appConfig.bankingSyncWaitMs) =>
      waitForSyncRun({ fastify, runId, timeoutMs }),
    close: () => {
      unsubscribe()
      client.close().catch(() => {})
    }
  }
  activeRelay = relay
  return relay
}

/** Test hook: reset the singleton so each spec starts clean. */
export const resetRelay = (): void => {
  activeRelay = null
}
