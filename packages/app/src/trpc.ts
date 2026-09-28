import {
  createTRPCClient,
  httpBatchLink,
  getFetch,
  type TRPCClient,
  TRPCClientError
} from '@trpc/client'
import type { EventBusRouter } from '@modular-api/event-bus'
import { useOAuthClient, user } from './oauth.js'
import { Notify } from 'quasar'
import { useLang } from './lang/index.js'
import { buildTrpcLinks } from './trpcLinks.js'
import type { AppRouter } from '@slimfact/api/trpc'

type BrowserRouter = AppRouter & EventBusRouter

export const initializeTRPCClient = async (apiHost: string) => {
  const oAuthClient = await useOAuthClient()
  const headers = () =>
    user
      ? {
          Authorization: `Bearer ${oAuthClient.value?.getAccessToken()}`
        }
      : {}

  const lang = useLang()
  const fetch = getFetch()

  // tRPC sends queries as GET and mutations as POST, so retrying is only safe -
  // and only useful - for reads: a batch never mixes the two. One lost read is
  // otherwise permanent, because the query layer has no retry of its own, and
  // the page stays empty until the user reloads (the e2e suite caught this as a
  // hang on the invoice list). Only transient failures are retried, so a real
  // outage still surfaces immediately.
  const READ_RETRY_DELAYS_MS = [250, 750]

  const isTransientStatus = (status: number) => status === 429 || status >= 500

  // tRPC types its fetch as FetchEsque, whose response carries no `status`, but
  // getFetch() returns a real Response at runtime. Read it defensively: an
  // implementation without one simply never retries.
  const statusOf = (res: unknown): number => {
    const status = (res as { status?: unknown }).status
    return typeof status === 'number' ? status : 0
  }

  const fetchReadWithRetry = async (url: URL, init?: RequestInit) => {
    const isRead = !init?.method || init.method.toUpperCase() === 'GET'
    const attempts = isRead ? READ_RETRY_DELAYS_MS.length + 1 : 1
    for (let attempt = 0; ; attempt++) {
      const delayMs = READ_RETRY_DELAYS_MS[attempt - 1]
      if (delayMs !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
      if (init?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      try {
        const res = await fetch(url, init)
        const lastAttempt = attempt === attempts - 1
        if (lastAttempt || !isTransientStatus(statusOf(res))) return res
      } catch (error) {
        if (attempt === attempts - 1) throw error
      }
    }
  }

  const handleErrorFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    // SSRF guard: only ever talk to the api origin this client was built for.
    // httpBatchLink hands us its own request URLs, but the wrapper accepts
    // arbitrary input — never fetch anything off-origin.
    const host = `https://${apiHost}`
    let url: URL
    try {
      url =
        typeof input === 'string'
          ? new URL(input, host)
          : input instanceof URL
            ? input
            : new URL(input.url)
    } catch {
      throw new Error('Invalid request URL')
    }
    if (url.origin !== host) {
      throw new Error(`Refusing to fetch non-api origin: ${url.origin}`)
    }
    const res = await fetchReadWithRetry(url, init)
    try {
      if (!res.ok) {
        const body = await (res as Response).clone().json()

        const serverErrors = body?.error || body?.[0]?.error
        let caption: string
        const { message, code, path, expected, received } = serverErrors
        const errors = lang.value.errors
        if (message) {
          caption = message
        } else if (path && errors?.[code]) {
          caption = errors[code]({ path, expected, received })
        } else if (path) {
          caption = `${message}: ${path.join(':')}`
        } else {
          caption = ''
        }
        Notify.create({
          message: lang.value.serverError,
          caption,
          type: 'negative'
        })
      }
    } catch (e) {
      console.error(e)
    }
    return res
  }

  const host = `https://${apiHost}`

  const httpLink = httpBatchLink({
    url: new URL('/trpc', host),
    fetch: handleErrorFetch,
    headers
  })

  trpc = createTRPCClient<BrowserRouter>({
    links: buildTrpcLinks({
      wsUrl: `wss://${apiHost}/ws`,
      getToken: () => oAuthClient.value?.getAccessToken(),
      httpLink,
      isBrowser: typeof window !== 'undefined'
    })
  })
}

export let trpc: TRPCClient<BrowserRouter>

export function isTRPCClientError(
  cause: unknown
): cause is TRPCClientError<AppRouter> {
  return cause instanceof TRPCClientError
}
