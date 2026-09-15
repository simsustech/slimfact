import { createEventBusServer } from "@modular-api/event-bus";
import type { Identity } from "@modular-api/event-bus";
import type { Kysely } from "kysely";
import { isValidKey } from "./api-keys/keys.js";
import { findKeyByHash } from "./api-keys/repository.js";
import { bankEventSchemas, type BankEventSchemas } from "./events.js";
import type { DB } from "./kysely/types.js";

/**
 * Authenticates an event-bus connection from the WS handshake `Authorization`
 * header (same hash lookup as the tRPC HTTP context). Throwing rejects and
 * closes the socket.
 */
export const createApiKeyAuthenticate =
  (db: Kysely<DB>) =>
  async ({ req }: { req?: unknown }): Promise<Identity> => {
    const headers = (req as { headers?: Record<string, string | string[] | undefined> } | undefined)
      ?.headers;
    const authorization = headers?.authorization;
    const token =
      typeof authorization === "string" && authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : undefined;
    if (!token) {
      throw new Error("Missing API key");
    }
    const apiKey = await findKeyByHash(db, token);
    if (!apiKey) {
      throw new Error("Unknown API key");
    }
    if (!isValidKey(apiKey)) {
      throw new Error("API key revoked or expired");
    }
    return { id: apiKey.label, apiKeyId: apiKey.id, scopes: apiKey.scopes };
  };

/** Wires the proxy's event bus into a tRPC server (mount at `/ws`). */
export const createProxyEventBus = (db: Kysely<DB>) =>
  createEventBusServer<BankEventSchemas>({
    events: bankEventSchemas,
    authenticate: createApiKeyAuthenticate(db),
  });
