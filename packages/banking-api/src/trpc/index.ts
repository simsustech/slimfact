import { initTRPC, TRPCError } from "@trpc/server";
import type { FastifyRequest } from "fastify";
import type { Kysely } from "kysely";
import type { PgBoss } from "pg-boss";
import { isValidKey } from "../api-keys/keys.js";
import { findKeyByHash, type ApiKeyIdentity } from "../api-keys/repository.js";
import type { DB } from "../kysely/types.js";

export interface MachineContext {
  db: Kysely<DB>;
  boss: PgBoss | null;
  /** Null until the `Authorization: Bearer` header resolves to a stored key. */
  apiKey: ApiKeyIdentity | null;
}

export interface TrpcDeps {
  db: Kysely<DB>;
  boss: PgBoss | null;
}

const extractBearer = (authorization: string | undefined): string | undefined =>
  authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

export const createContext =
  (deps: TrpcDeps) =>
  async ({ req }: { req: FastifyRequest }): Promise<MachineContext> => {
    const token = extractBearer(req.headers.authorization);
    const apiKey = token ? await findKeyByHash(deps.db, token) : null;
    return { db: deps.db, boss: deps.boss, apiKey };
  };

export const t = initTRPC.context<MachineContext>().create();

/** Rejects requests without a valid (known, non-revoked, non-expired) API key. */
export const apiKeyProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.apiKey) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing or unknown API key" });
  }
  if (!isValidKey(ctx.apiKey)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "API key is revoked or expired" });
  }
  return next({ ctx: { ...ctx, apiKey: ctx.apiKey } });
});

/** Gates a procedure on a per-key scope (default keys are read-only). */
export const requireScope = (scope: "read" | "sync") =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.apiKey?.scopes.includes(scope)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Missing scope: ${scope}` });
    }
    return next();
  });

export { createAppRouter } from "./machine.js";
