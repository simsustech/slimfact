import { afterEach, describe, expect, it, vi } from "vitest";
import { createMollieAdapter } from "../../src/banking/pspAdapters.js";

// Fixtures shaped like the live Mollie HAL responses
// (https://docs.mollie.com/reference/list-settlements). `_embedded` / `_links`
// are the wire keys; the SDK remaps them to `result.embedded` / `result.links`.
const url = (href: string) => ({ href, type: "application/hal+json" });

const settlement = (id: string) => ({
  resource: "settlement",
  id,
  reference: "1234567.2404.03",
  settledAt: "2026-07-31T12:00:00+00:00",
  createdAt: "2026-07-30T08:00:00+00:00",
  status: "paidout",
  amount: { value: "100.00", currency: "EUR" },
  balanceId: "bal_mock",
  periods: {
    "2026": {
      "07": {
        costs: [
          {
            description: "Payment fees",
            method: "ideal",
            count: 1,
            rate: { fixed: { value: "0.29", currency: "EUR" }, percentage: "1.00" },
            amountNet: { value: "1.00", currency: "EUR" },
            amountVat: { value: "0.21", currency: "EUR" },
            amountGross: { value: "1.21", currency: "EUR" },
          },
          {
            description: "Payment fees",
            method: "creditcard",
            count: 1,
            rate: { fixed: { value: "0.25", currency: "EUR" }, percentage: "1.00" },
            amountNet: { value: "0.50", currency: "EUR" },
            amountVat: { value: "0.11", currency: "EUR" },
            amountGross: { value: "0.61", currency: "EUR" },
          },
        ],
      },
    },
  },
  _links: { self: url(`https://api.mollie.com/v2/settlements/${id}`) },
});

const payment = (id: string) => ({
  resource: "payment",
  id,
  mode: "test",
  description: `invoice-${id}`,
  amount: { value: "25.00", currency: "EUR" },
  routing: null,
  sequenceType: "oneoff",
  profileId: "pfl_mock",
  status: "paid",
  createdAt: "2026-07-30T10:00:00+00:00",
  _links: {
    self: url(`https://api.mollie.com/v2/payments/${id}`),
    dashboard: url(`https://my.mollie.com/dashboard/payments/${id}`),
  },
});

const settlementsPage = (nextHref: string | null) => ({
  count: 1,
  _embedded: { settlements: [settlement("stl_1")] },
  _links: {
    self: url("https://api.mollie.com/v2/settlements?limit=100"),
    previous: null,
    next: nextHref ? url(nextHref) : null,
    documentation: url("https://docs.mollie.com/reference/list-settlements"),
  },
});

const paymentsPage = (ids: string[], nextHref: string | null) => ({
  count: ids.length,
  _embedded: { payments: ids.map(payment) },
  _links: {
    self: url("https://api.mollie.com/v2/settlements/stl_1/payments?limit=100"),
    previous: null,
    next: nextHref ? url(nextHref) : null,
    documentation: url("https://docs.mollie.com/reference/list-settlement-payments"),
  },
});

/** Stubs global fetch (the SDK's transport) and records the requested URLs. */
const stubFetch = (respond: (requestUrl: string) => unknown) => {
  const requested: string[] = [];
  const fn = vi.fn(async (input: unknown) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : String((input as { url?: string }).url ?? "");
    requested.push(requestUrl);
    return new Response(JSON.stringify(respond(requestUrl)), {
      status: 200,
      headers: { "content-type": "application/hal+json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return requested;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createMollieAdapter", () => {
  it("maps a settlements page, sums the period fees, and reads the cursor from _links.next", async () => {
    const requested = stubFetch(() =>
      settlementsPage("https://api.mollie.com/v2/settlements?limit=100&from=stl_next"),
    );

    const page = await createMollieAdapter("test_key").listSettlements({ limit: 100 });

    expect(requested[0]).toContain("/v2/settlements");
    expect(requested[0]).toContain("limit=100");
    expect(page.items).toEqual([
      {
        externalId: "stl_1",
        amountCents: 10000,
        feeCents: 150,
        currency: "EUR",
        payoutDate: "2026-07-31T12:00:00+00:00",
        status: "paidout",
        metadata: { reference: "1234567.2404.03" },
      },
    ]);
    expect(page.nextFrom).toBe("stl_next");
  });

  it("reads the cursor from a relative _links.next href and returns undefined without one", async () => {
    stubFetch(() => settlementsPage("/v2/settlements?limit=100&from=stl_relative"));
    const relative = await createMollieAdapter("test_key").listSettlements({ limit: 100 });
    expect(relative.nextFrom).toBe("stl_relative");

    stubFetch(() => settlementsPage(null));
    const last = await createMollieAdapter("test_key").listSettlements({ limit: 100 });
    expect(last.nextFrom).toBeUndefined();
  });

  it("returns one payments page per call, forwarding the cursor and mapping every payment", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => `tr_page1_${index}`);
    const secondPage = Array.from({ length: 50 }, (_, index) => `tr_page2_${index}`);
    const requested = stubFetch((requestUrl) =>
      requestUrl.includes("from=p2")
        ? paymentsPage(secondPage, null)
        : paymentsPage(
            firstPage,
            "https://api.mollie.com/v2/settlements/stl_1/payments?limit=100&from=p2",
          ),
    );

    const adapter = createMollieAdapter("test_key");
    const first = await adapter.listSettlementPayments("stl_1", { limit: 100 });
    const second = await adapter.listSettlementPayments("stl_1", {
      limit: 100,
      from: first.nextFrom,
    });

    expect(requested[0]).toContain("/v2/settlements/stl_1/payments");
    expect(requested[1]).toContain("from=p2");
    expect(first.items).toHaveLength(100);
    expect(first.nextFrom).toBe("p2");
    expect(second.items).toHaveLength(50);
    expect(second.nextFrom).toBeUndefined();
    expect(first.items[0]).toEqual({
      externalId: "tr_page1_0",
      amountCents: 2500,
      currency: "EUR",
      description: "invoice-tr_page1_0",
      status: "paid",
      paidAt: new Date("2026-07-30T10:00:00+00:00"),
    });
    expect([...first.items, ...second.items].map((item) => item.externalId)).toHaveLength(150);
  });
});
