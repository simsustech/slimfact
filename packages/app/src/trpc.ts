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

  const handleErrorFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    return fetch(input, init).then(async (res) => {
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
        return res
      } catch (e) {
        console.error(e)
        return res
      }
    })
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
      getToken: () => oAuthClient.value?.getAccessToken() ?? undefined,
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
