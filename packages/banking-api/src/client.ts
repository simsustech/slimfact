import { createTRPCClient, createWSClient, httpBatchLink, splitLink, wsLink } from "@trpc/client";
import type { EventBusRouter } from "@modular-api/event-bus";
import type { EventMessage } from "@modular-api/event-bus";
import WebSocket from "ws";
import type { AppRouter } from "./trpc/types.js";

export interface BankingApiClientOptions {
  /** Proxy base URL, e.g. `http://banking-api`. */
  url: string;
  /** API key from the proxy's mounted config file (grant-scoped). */
  apiKey: string;
  /** WS path the proxy mounted the event bus on. Default `/ws`. */
  wsPath?: string;
}

/**
 * Typed machine client for the proxy: queries/mutations over HTTP (Bearer
 * header), the event-bus subscription over WS (header at handshake).
 *
 * The annotation is deliberately typed against `AppRouter` only (portable,
 * this package's own tRPC); the event-bus subscription procedures are
 * available on the value but not named here.
 */
export const createBankingApiClient = ({
  url,
  apiKey,
  wsPath = "/ws",
}: BankingApiClientOptions): BankingApiClient => {
  const wsUrl = url.replace(/^http/, "ws") + wsPath;
  const headers = () => ({ authorization: `Bearer ${apiKey}` });

  class WebSocketWithHeaders extends WebSocket {
    constructor(wsUrl: string) {
      super(wsUrl, { headers: headers() });
    }
  }

  const wsClient = createWSClient({
    url: wsUrl,
    // SAFETY: `ws` implements the subset of the DOM WebSocket API that tRPC's
    // wsLink drives (send/close/readyState + the event handlers). The two class
    // types do not overlap structurally, so `unknown` is required here.
    WebSocket: WebSocketWithHeaders as unknown as typeof globalThis.WebSocket,
  });

  const client = createTRPCClient<AppRouter & EventBusRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: wsLink({ client: wsClient }),
        false: httpBatchLink({ url: `${url}/trpc`, headers }),
      }),
    ],
  });

  const subscribeEvents = (
    topicGlob: string,
    handler: (message: EventMessage) => void,
  ): (() => void) => {
    const subscription = client.subscribe.subscribe(topicGlob, {
      onData: (message) => handler(message as EventMessage),
    });
    return () => subscription.unsubscribe();
  };

  const close = () => wsClient.close();

  // The tRPC client is a recursive proxy that answers EVERY property access
  // with a procedure callable, so extras can't be Object.assign'ed onto it —
  // wrap it and answer the two helper keys before the inner proxy sees them.
  // SAFETY: the `get` trap answers `subscribeEvents`/`close` before the tRPC
  // proxy sees them, so both exist at runtime. `unknown` is required because
  // neither type overlaps: BankingApiClient adds those two members, and its
  // tRPC half is narrowed to `AppRouter` while the value also carries
  // EventBusRouter's procedures.
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "subscribeEvents") return subscribeEvents;
      if (prop === "close") return close;
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown as BankingApiClient;
};

export type BankingApiClient = ReturnType<typeof createTRPCClient<AppRouter>> & {
  subscribeEvents(topicGlob: string, handler: (message: EventMessage) => void): () => void;
  close(): Promise<void>;
};
