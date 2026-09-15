import { z } from "zod";

/** Typed topics the proxy publishes on the event bus (D10/D13/D15). */
export const bankEventSchemas = {
  "bank.sync.started": z.object({ runId: z.string() }),
  "bank.sync.accountSynced": z.object({
    runId: z.string(),
    accountId: z.string(),
    newTransactions: z.number(),
  }),
  "bank.sync.accountSkipped": z.object({
    runId: z.string(),
    accountId: z.string(),
    reason: z.enum(["reauth", "rate_limited"]),
  }),
  "bank.sync.finished": z.object({
    runId: z.string(),
    status: z.enum(["finished", "rate_limited", "failed"]),
    accountsSynced: z.number(),
    accountsSkippedReauth: z.number(),
    newTransactions: z.number(),
  }),
  "bank.sync.failed": z.object({ runId: z.string(), error: z.string() }),
  "bank.connection.requiresReauth": z.object({
    connectionId: z.string(),
    aspspName: z.string(),
    validUntil: z.string(),
  }),
} as const;

export type BankEventSchemas = typeof bankEventSchemas;
