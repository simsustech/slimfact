import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { appConfig } from "../config/env.js";
import { PSP_SYNC_QUEUE, SYNC_QUEUE } from "../pgboss.js";
import { apiKeyProcedure, requireScope, t } from "./index.js";
import type { MachineContext } from "./index.js";

type RouterCtx = MachineContext & { apiKey: NonNullable<MachineContext["apiKey"]> };
const accountIdInput = z.object({ accountId: z.string() });

/**
 * Resolves an external account id to the internal row, but only when the
 * requesting key holds a grant for it. Everything else sees NOT_FOUND.
 */
const getGrantedAccount = async (ctx: RouterCtx, externalId: string) => {
  const account = await ctx.db
    .selectFrom("accounts")
    .selectAll()
    .where("externalId", "=", externalId)
    .where("id", "in", ctx.apiKey.accountIds)
    .executeTakeFirst();
  if (!account) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Account '${externalId}' not found` });
  }
  return account;
};

export const createAppRouter = () => {
  return t.router({
    listAccounts: apiKeyProcedure.query(async ({ ctx }) => {
      const accountIds = ctx.apiKey!.accountIds;
      if (accountIds.length === 0) return [];
      return ctx.db
        .selectFrom("accounts")
        .selectAll()
        .where("id", "in", accountIds)
        .orderBy("externalId")
        .execute();
    }),

    getAccount: apiKeyProcedure.input(accountIdInput).query(async ({ ctx, input }) => {
      return getGrantedAccount(ctx, input.accountId);
    }),

    listBalances: apiKeyProcedure.input(accountIdInput).query(async ({ ctx, input }) => {
      const account = await getGrantedAccount(ctx, input.accountId);
      return ctx.db
        .selectFrom("balances")
        .selectAll()
        .where("accountId", "=", account.id)
        .orderBy("type")
        .execute();
    }),

    listTransactions: apiKeyProcedure
      .input(
        z.object({
          accountId: z.string(),
          from: z.string().optional(),
          to: z.string().optional(),
          limit: z.number().int().min(1).max(200).default(50),
          offset: z.number().int().min(0).default(0),
        }),
      )
      .query(async ({ ctx, input }) => {
        const account = await getGrantedAccount(ctx, input.accountId);
        let itemsQuery = ctx.db
          .selectFrom("transactions")
          .selectAll()
          .where("accountId", "=", account.id);
        let countQuery = ctx.db
          .selectFrom("transactions")
          .select(ctx.db.fn.countAll<number>().as("count"))
          .where("accountId", "=", account.id);
        if (input.from) {
          itemsQuery = itemsQuery.where("bookingDate", ">=", input.from);
          countQuery = countQuery.where("bookingDate", ">=", input.from);
        }
        if (input.to) {
          itemsQuery = itemsQuery.where("bookingDate", "<=", input.to);
          countQuery = countQuery.where("bookingDate", "<=", input.to);
        }

        const items = await itemsQuery
          .orderBy("bookingDate", "desc")
          .limit(input.limit)
          .offset(input.offset)
          .execute();
        const count = await countQuery.executeTakeFirst();

        return { items, total: Number(count?.count ?? 0) };
      }),

    listConnections: apiKeyProcedure.query(async ({ ctx }) => {
      const accountIds = ctx.apiKey!.accountIds;
      if (accountIds.length === 0) return [];
      const aspspNames = await ctx.db
        .selectFrom("accounts")
        .select("aspspName")
        .where("id", "in", accountIds)
        .distinct()
        .execute();
      const names = aspspNames.map((row) => row.aspspName);
      if (names.length === 0) return [];
      return ctx.db.selectFrom("connections").selectAll().where("aspspName", "in", names).execute();
    }),

    /**
     * Enqueues a sync run on the proxy's queue and returns fast (D15). The
     * worker creates/updates the `sync_runs` row; if the send is deduped by the
     * singleton cooldown, no row appears and clients fall back to getSyncStatus.
     */
    sync: apiKeyProcedure.use(requireScope("sync")).mutation(async ({ ctx }) => {
      if (!ctx.boss) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Sync queue not available",
        });
      }
      const runId = randomUUID();
      // "Sync now" triggers BOTH queues: the bank-transaction sync and the
      // PSP payout ingestion (same runId, per-queue singleton cooldowns).
      await ctx.boss.send(
        SYNC_QUEUE,
        { runId },
        {
          singletonKey: "sync-all",
          singletonSeconds: appConfig.openbankingSyncCooldownSeconds,
        },
      );
      await ctx.boss.send(
        PSP_SYNC_QUEUE,
        { runId },
        {
          singletonKey: "psp-sync",
          singletonSeconds: appConfig.pspSyncCooldownSeconds,
        },
      );
      return { queued: true, runId };
    }),
    getSyncStatus: apiKeyProcedure.query(async ({ ctx }) => {
      // Sync-run state is proxy-global; a key with zero grants sees nothing.
      if (ctx.apiKey.accountIds.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "API key has no granted accounts",
        });
      }
      const latest = await ctx.db
        .selectFrom("sync_runs")
        .selectAll()
        .orderBy("startedAt", "desc")
        .limit(1)
        .executeTakeFirst();
      if (!latest) return { status: "idle" as const };
      return {
        status: latest.status,
        runId: latest.runId,
        startedAt: latest.startedAt.toISOString(),
        finishedAt: latest.finishedAt ? latest.finishedAt.toISOString() : null,
        accountsTotal: latest.accountsTotal,
        accountsSynced: latest.accountsSynced,
        accountsSkippedReauth: latest.accountsSkippedReauth,
        accountsSkippedRateLimited: latest.accountsSkippedRateLimited,
        // Internal error detail (message text) stays server-side; clients only
        // learn whether the run failed.
        hasError: latest.error !== null,
      };
    }),

    /**
     * PSP payout history (Mollie settlements / Stripe payouts + payments).
     * Read-only; granted by the key's read scope by default. `from` filters on
     * the payout/paid date (inclusive), `psp` on the provider.
     */
    listPspSettlements: apiKeyProcedure
      .input(
        z.object({
          from: z.string().optional(),
          psp: z.enum(["mollie", "stripe"]).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const accountIds = ctx.apiKey.accountIds;
        if (accountIds.length === 0) return [];
        let query = ctx.db.selectFrom("psp_settlements").selectAll();
        if (input.from) query = query.where("payoutDate", ">=", input.from);
        if (input.psp) query = query.where("psp", "=", input.psp);
        return query.orderBy("payoutDate", "desc").execute();
      }),

    listPspPayments: apiKeyProcedure
      .input(
        z.object({
          settlementId: z.string().optional(),
          psp: z.enum(["mollie", "stripe"]).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const accountIds = ctx.apiKey.accountIds;
        if (accountIds.length === 0) return [];
        let query = ctx.db.selectFrom("psp_payments").selectAll();
        if (input.settlementId) {
          query = query.where("settlementId", "=", input.settlementId);
        }
        if (input.psp) query = query.where("psp", "=", input.psp);
        return query.orderBy("paidAt", "desc").execute();
      }),
  });
};
