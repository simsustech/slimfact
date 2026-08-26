import { createWSClient, splitLink, wsLink, type TRPCLink } from '@trpc/client'
import type { AnyRouter } from '@trpc/server'

export interface BuildTrpcLinksOptions {
  /** e.g. `wss://api.example.com/ws` (the api mounts the event bus there). */
  wsUrl: string
  /** Returns the current OAuth access token for the WS connectionParams. */
  getToken: () => string | undefined
  /** The HTTP batch link (queries/mutations). */
  httpLink: TRPCLink<AnyRouter>
  /** True on the client only (browsers can set WS connectionParams but not headers). */
  isBrowser: boolean
}

/**
 * Pure link builder: server/SSR gets HTTP only; the browser additionally gets a
 * split link routing subscriptions to the WS event bus with the OAuth token as
 * `connectionParams` (the first WS message).
 */
export const buildTrpcLinks = ({
  wsUrl,
  getToken,
  httpLink,
  isBrowser
}: BuildTrpcLinksOptions): TRPCLink<AnyRouter>[] => {
  if (!isBrowser) return [httpLink]
  return [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: wsLink({
        client: createWSClient({
          url: wsUrl,
          connectionParams: () => ({ token: getToken() ?? '' })
        })
      }),
      false: httpLink
    })
  ]
}
