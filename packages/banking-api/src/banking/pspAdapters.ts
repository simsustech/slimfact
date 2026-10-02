import { Client } from "mollie-api-typescript";
import Stripe from "stripe";
import { parseAmountToCents } from "@slimfact/tools/banking";
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

/** Mollie: settlements + the payments included in each settlement.
 * `_links.next` carries the pagination cursor in its `from` param. */
const MOLLIE_API_BASE = "https://api.mollie.com";

const mollieNextFrom = (href: string | null | undefined): string | undefined => {
  if (!href) return undefined;
  try {
    return new URL(href, MOLLIE_API_BASE).searchParams.get("from") ?? undefined;
  } catch {
    return undefined;
  }
};

export const createMollieAdapter = (apiKey: string): PspAdapter => {
  const client = new Client({ security: { apiKey } });
  return {
    listSettlements: async ({ limit, from }) => {
      const page = await client.settlements.list({ limit, from });
      const items: PspSettlementItem[] = page.result.embedded.settlements.map((settlement) => ({
        externalId: settlement.id,
        amountCents: parseAmountToCents(settlement.amount.value),
        feeCents: mollieFeeCents(settlement),
        currency: settlement.amount.currency,
        payoutDate: settlement.settledAt ?? settlement.createdAt ?? null,
        status: settlement.status,
        metadata: { reference: settlement.reference },
      }));
      return { items, nextFrom: mollieNextFrom(page.result.links.next?.href) };
    },
    listSettlementPayments: async (settlementId, { limit, from }) => {
      const page = await client.settlements.listPayments({ settlementId, limit, from });
      const items: PspPaymentItem[] = (page.result.embedded.payments ?? []).map((payment) => ({
        externalId: payment.id,
        amountCents: parseAmountToCents(payment.amount.value),
        currency: payment.amount.currency,
        description: payment.description,
        status: payment.status,
        paidAt: payment.createdAt ? new Date(payment.createdAt) : null,
      }));
      return { items, nextFrom: mollieNextFrom(page.result.links.next?.href) };
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
        starting_after: from,
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
    listSettlementPayments: async (payoutId, { limit, from }) => {
      const list = await stripe.balanceTransactions.list({
        payout: payoutId,
        limit,
        starting_after: from,
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
      const lastId = list.data.at(-1)?.id;
      return { items, nextFrom: list.has_more && lastId ? lastId : undefined };
    },
  };
};
