import type { Kysely } from "kysely";
import type { DB } from "../kysely/types.js";

export type Psp = "mollie" | "stripe";

export interface SyncLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** One normalized payout/settlement row (net amount in cents). */
export interface PspSettlementItem {
  externalId: string;
  amountCents: number;
  feeCents: number | null;
  currency: string;
  payoutDate: string | null;
  status: string | null;
  metadata: Record<string, unknown>;
}

/** One payment inside a settlement (gross amount in cents). */
export interface PspPaymentItem {
  externalId: string;
  amountCents: number;
  currency: string;
  /** PSP-provided description — the checkout plugin stores the invoice uuid. */
  description: string | null;
  status: string | null;
  paidAt: Date | null;
}

/**
 * A single PSP's payout API, normalized so runPspSync stays PSP-agnostic.
 * Implementations wrap the Mollie/Stripe SDKs (see pspAdapters.ts); specs
 * inject mocks.
 */
export interface PspAdapter {
  /** Settlements/payouts, newest first. `from` is a cursor for pagination. */
  listSettlements(params: {
    limit: number;
    from?: string;
  }): Promise<{ items: PspSettlementItem[]; nextFrom?: string }>;
  /** Payments included in one settlement (Mollie) / linked balance
   * transactions (Stripe payout → payment_intent). */
  listSettlementPayments(
    settlementId: string,
    params: { limit: number },
  ): Promise<PspPaymentItem[]>;
}

export interface PspSyncDeps {
  db: Kysely<DB>;
  log: SyncLogger;
  runId: string;
  adapters: Partial<Record<Psp, PspAdapter>>;
}

export interface PspSyncResult {
  /** Genuinely new settlements upserted this run. */
  settlements: number;
  /** Genuinely new payments upserted this run. */
  payments: number;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/**
 * Ingests PSP payout history (Mollie settlements + their payments, Stripe
 * payouts + linked balance transactions) into the open_banking schema. Upserts
 * via onConflict — never deletes; history accumulates. Idempotent: a second
 * run reports 0 new rows (per-PSP existing-id sets are built up front).
 * Mirrors banking/sync.ts's shape but is PSP-only; each PSP failure is logged
 * and does not abort the others.
 */
export const runPspSync = async (deps: PspSyncDeps): Promise<PspSyncResult> => {
  const { db, log, runId, adapters } = deps;
  const result: PspSyncResult = { settlements: 0, payments: 0 };
  const now = new Date();

  for (const psp of ["mollie", "stripe"] as const) {
    const adapter = adapters[psp];
    if (!adapter) continue;

    const existingSettlementIds = new Set(
      (
        await db.selectFrom("psp_settlements").select("externalId").where("psp", "=", psp).execute()
      ).map((row) => row.externalId),
    );
    const existingPaymentIds = new Set(
      (
        await db.selectFrom("psp_payments").select("externalId").where("psp", "=", psp).execute()
      ).map((row) => row.externalId),
    );

    try {
      let from: string | undefined;
      for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
        const page = await adapter.listSettlements({
          limit: PAGE_SIZE,
          from,
        });
        if (page.items.length === 0) break;

        for (const settlement of page.items) {
          await db
            .insertInto("psp_settlements")
            .values({
              externalId: settlement.externalId,
              psp,
              amountCents: settlement.amountCents,
              feeCents: settlement.feeCents,
              currency: settlement.currency,
              payoutDate: settlement.payoutDate,
              status: settlement.status,
              syncedAt: now,
              metadata: JSON.stringify(settlement.metadata),
            })
            .onConflict((conflict) =>
              conflict.column("externalId").doUpdateSet({
                psp,
                amountCents: settlement.amountCents,
                feeCents: settlement.feeCents,
                currency: settlement.currency,
                payoutDate: settlement.payoutDate,
                status: settlement.status,
                syncedAt: now,
                metadata: JSON.stringify(settlement.metadata),
              }),
            )
            .execute();
          if (!existingSettlementIds.has(settlement.externalId)) {
            existingSettlementIds.add(settlement.externalId);
            result.settlements += 1;
          }

          const payments = await adapter.listSettlementPayments(settlement.externalId, {
            limit: PAGE_SIZE,
          });
          for (const payment of payments) {
            await db
              .insertInto("psp_payments")
              .values({
                psp,
                externalId: payment.externalId,
                settlementId: settlement.externalId,
                amountCents: payment.amountCents,
                currency: payment.currency,
                description: payment.description,
                status: payment.status,
                paidAt: payment.paidAt,
                syncedAt: now,
              })
              .onConflict((conflict) =>
                conflict.columns(["psp", "externalId"]).doUpdateSet({
                  settlementId: settlement.externalId,
                  amountCents: payment.amountCents,
                  currency: payment.currency,
                  description: payment.description,
                  status: payment.status,
                  paidAt: payment.paidAt,
                  syncedAt: now,
                }),
              )
              .execute();
            if (!existingPaymentIds.has(payment.externalId)) {
              existingPaymentIds.add(payment.externalId);
              result.payments += 1;
            }
          }
        }

        if (!page.nextFrom) break;
        from = page.nextFrom;
      }
    } catch (error) {
      log.error(`pspSync: ${psp} sync failed (run ${runId}): ${String(error)}`);
    }
  }

  return result;
};
