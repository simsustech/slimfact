import type { EventBus } from "@modular-api/event-bus";
import type { Kysely } from "kysely";
import type { PgBoss, WorkOptions } from "pg-boss";
import type { BankingApi } from "./banking/client.js";
import { runSync, type SyncLogger } from "./banking/sync.js";
import { appConfig } from "./config/env.js";
import type { BankEventSchemas } from "./events.js";
import type { DB } from "./kysely/types.js";
import { createMollieAdapter, createStripeAdapter } from "./banking/pspAdapters.js";
import { runPspSync } from "./banking/pspSync.js";

export const SYNC_QUEUE = "syncBankTransactions";
export const PSP_SYNC_QUEUE = "syncPspSettlements";

export interface SyncInitializeOptions {
  fastify: {
    banking: {
      db: Kysely<DB>;
      getClient: () => BankingApi | null;
      eventBus: { bus: EventBus<BankEventSchemas> };
    };
    log: SyncLogger;
  };
  boss: PgBoss;
}

/**
 * Registers the sync queue: cron schedule + singleton worker (cooldown on both
 * `send` and `work` per D14). Registered unconditionally — without open-banking
 * credentials the worker runs a tame sync (no accounts, but `bank.sync.*`
 * events still flow so consumers' bus-driven UX works).
 */
export const initialize = async ({ fastify, boss }: SyncInitializeOptions): Promise<void> => {
  await boss.createQueue(SYNC_QUEUE);
  await boss.schedule(SYNC_QUEUE, appConfig.openbankingSyncCron, {}, {});

  // `singletonKey`/`singletonSeconds` are documented work() options (cooldown
  // after a run, D14) but missing from the WorkOptions types — cast, runtime supports.
  const workOptions = {
    batchSize: 1,
    singletonKey: "sync-all",
    singletonSeconds: appConfig.openbankingSyncCooldownSeconds,
    includeMetadata: true,
  } as WorkOptions;

  await boss.work<{ runId?: string }>(SYNC_QUEUE, workOptions, async (jobs) => {
    for (const job of jobs) {
      const runId = job.data?.runId ?? `cron-${Date.now()}`;
      const client = fastify.banking.getClient();
      if (!client) {
        // Tame run: no open-banking credentials — no accounts to sync, but keep
        // the bus flow + sync_runs consistent so consumers never hang.
        await fastify.banking.db
          .insertInto("sync_runs")
          .values({ runId, status: "finished" })
          .onConflict((conflict) => conflict.column("runId").doNothing())
          .execute();
        fastify.banking.eventBus.bus.publish("bank.sync.started", { runId });
        fastify.banking.eventBus.bus.publish("bank.sync.finished", {
          runId,
          status: "finished",
          accountsSynced: 0,
          accountsSkippedReauth: 0,
          newTransactions: 0,
        });
        continue;
      }
      await runSync({
        db: fastify.banking.db,
        client,
        bus: fastify.banking.eventBus.bus,
        log: fastify.log,
        runId,
      });
    }
    return true;
  });

  await initializePspSync({ fastify, boss });
};

/**
 * PSP payout ingestion queue: cron schedule + singleton worker with the same
 * cooldown pattern as the bank queue. Without PSP API keys the worker is a
 * no-op (no adapters). "Sync now" (the proxy's `sync` mutation) enqueues this
 * queue alongside the bank queue.
 */
export const initializePspSync = async ({
  fastify,
  boss,
}: SyncInitializeOptions): Promise<void> => {
  await boss.createQueue(PSP_SYNC_QUEUE);
  await boss.schedule(PSP_SYNC_QUEUE, appConfig.pspSyncCron, {}, {});

  const workOptions = {
    batchSize: 1,
    singletonKey: "psp-sync",
    singletonSeconds: appConfig.pspSyncCooldownSeconds,
    includeMetadata: true,
  } as WorkOptions;

  await boss.work<{ runId?: string }>(PSP_SYNC_QUEUE, workOptions, async (jobs) => {
    for (const job of jobs) {
      await runPspSync({
        db: fastify.banking.db,
        log: fastify.log,
        runId: job.data?.runId ?? `psp-cron-${Date.now()}`,
        adapters: {
          mollie: appConfig.mollieApiKey ? createMollieAdapter(appConfig.mollieApiKey) : undefined,
          stripe: appConfig.stripeApiKey ? createStripeAdapter(appConfig.stripeApiKey) : undefined,
        },
      });
    }
    return true;
  });
};
