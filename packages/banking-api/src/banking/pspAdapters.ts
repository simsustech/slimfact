import { createMollieClient } from "@mollie/api-client";
import Stripe from "stripe";
import { parseAmountToCents } from "./money.js";
import type { PspAdapter, PspPaymentItem, PspSettlementItem } from "./pspSync.js";

/** Sums the settlement's withheld costs (fees) across all periods, in cents. */
const mollieFeeCents = (settlement: {
  periods?: Record<string, Record<string, { costs?: Array<{ amountNet: { value: string } }> }>>;
}): number | null => {
  let total = 0;
  let found = false;
  for (const year of Object.values(settlement.periods ?? {})) {
    for (const period of Object.values(year)) {
      for (const cost of period.costs ?? []) {
        total += parseAmountToCents(cost.amountNet.value);
        found = true;
      }
    }
  }
  return found ? total : null;
};

/** Mollie: settlements + the payments included in each settlement. */
export const createMollieAdapter = (apiKey: string): PspAdapter => {
  const client = createMollieClient({ apiKey });
  return {
    listSettlements: async ({ limit, from }) => {
      const page = await client.settlements.page({ limit, from });
      const items: PspSettlementItem[] = page.map((settlement) => ({
        externalId: settlement.id,
        amountCents: parseAmountToCents(settlement.amount.value),
        feeCents: mollieFeeCents(settlement),
        currency: settlement.amount.currency,
        payoutDate: settlement.settledAt ?? settlement.createdAt ?? null,
        status: settlement.status,
        metadata: { reference: settlement.reference },
      }));
      return { items, nextFrom: page.nextPageCursor ?? undefined };
    },
    listSettlementPayments: async (settlementId, { limit }) => {
      const page = await client.settlementPayments.page({
        settlementId,
        limit,
      });
      const items: PspPaymentItem[] = page.map((payment) => ({
        externalId: payment.id,
        amountCents: parseAmountToCents(payment.amount.value),
        currency: payment.amount.currency,
        description: payment.description ?? null,
        status: payment.status,
        paidAt: payment.createdAt ? new Date(payment.createdAt) : null,
      }));
      return items;
    },
  };
};

/** Stripe: payouts + the balance transactions linked to each payout. */
export const createStripeAdapter = (apiKey: string): PspAdapter => {
  const stripe = new Stripe(apiKey);
  return {
    listSettlements: async ({ limit, from }) => {
      const list = await stripe.payouts.list({
        limit,
        starting_after: from ?? undefined,
      });
      const items: PspSettlementItem[] = list.data.map((payout) => ({
        externalId: payout.id,
        // Stripe amounts are already integer cents.
        amountCents: payout.amount,
        feeCents: null,
        currency: payout.currency.toUpperCase(),
        payoutDate: new Date(payout.created * 1000).toISOString().slice(0, 10),
        status: payout.status,
        metadata: { type: payout.type, method: payout.method },
      }));
      const lastId = list.data.at(-1)?.id;
      return { items, nextFrom: list.has_more && lastId ? lastId : undefined };
    },
    listSettlementPayments: async (payoutId, { limit }) => {
      const list = await stripe.balanceTransactions.list({
        payout: payoutId,
        limit,
      });
      const items: PspPaymentItem[] = list.data
        .filter((transaction) => !!transaction.source)
        .map((transaction) => ({
          // source is the payment_intent id for payment balance transactions.
          externalId: transaction.source as string,
          amountCents: Math.abs(transaction.amount),
          currency: transaction.currency.toUpperCase(),
          description: transaction.description ?? null,
          status: "paid",
          paidAt: new Date(transaction.created * 1000),
        }));
      return items;
    },
  };
};
