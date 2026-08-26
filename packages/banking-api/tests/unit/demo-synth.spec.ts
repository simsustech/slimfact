import { describe, expect, it } from "vitest";
import { synthDemoData, makeIban, type DemoGuide } from "../../src/seed/demo/synth.js";

// Fixed guide + seed so the test is deterministic and reproducible.
const GUIDE: DemoGuide = {
  companyCount: 3,
  clientCount: 14,
  numberedInvoiceCount: 50,
  unnumberedInvoiceCount: 150,
  settlementCount: 30,
  settlementPaymentCountRange: [1, 3],
  settlementFeeFixedCents: 29,
  settlementFeeRoundingCents: 1,
  refundRate: 0.02,
  invoiceAmountMedianCents: 8768,
  invoiceAmountMaxCents: 200000,
  amountSigma: 1.5,
  methodMix: { ideal: 0.8, creditcard: 0.2, banktransfer: 0.0, cash: 0.0 },
  invoiceStatusMix: { bill: 0.53, receipt: 0.44, paid: 0.014, canceled: 0.013, open: 0.001 },
  dateRange: { from: "2024-11-01", to: "2026-08-18" },
};

const SEED = 0x9e3779b9;

// Real markers that must never appear in synthetic output (observed in the
// production dump / live Mollie sample). The dump's company was
// "vofvanherwijnenbouman"; real Mollie ids use `tr_`/`stl_` underscore form.
const REAL_MARKERS = ["vanherwijnen", "bouman", "vofvanherwijnenbouman"];

/** Standard NL IBAN mod-97 validation. */
const isValidNlIban = (iban: string): boolean => {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  return BigInt(numeric) % 97n === 1n;
};

describe("synthDemoData", () => {
  it("is content-deterministic for a fixed (guide, seed)", () => {
    const a = synthDemoData(GUIDE, SEED);
    const b = synthDemoData(GUIDE, SEED);
    expect(a.core.invoices).toEqual(b.core.invoices);
    expect(a.core.payments).toEqual(b.core.payments);
    expect(a.banking.pspSettlements).toEqual(b.banking.pspSettlements);
    expect(a.banking.pspPayments).toEqual(b.banking.pspPayments);
  });

  it("produces the requested scale", () => {
    const d = synthDemoData(GUIDE, SEED);
    expect(d.core.companies).toHaveLength(GUIDE.companyCount);
    expect(d.core.clients).toHaveLength(GUIDE.clientCount);
    expect(d.core.invoices).toHaveLength(GUIDE.numberedInvoiceCount + GUIDE.unnumberedInvoiceCount);
    expect(d.banking.pspSettlements).toHaveLength(GUIDE.settlementCount);
    expect(d.banking.accounts.length).toBeGreaterThanOrEqual(2);
  });

  it("generates only mod-97-valid IBANs", () => {
    const d = synthDemoData(GUIDE, SEED);
    const ibans = [
      ...d.core.companies.map((c) => c.iban),
      ...d.banking.accounts.map((a) => a.iban),
    ];
    for (const iban of ibans) {
      expect(isValidNlIban(iban)).toBe(true);
    }
  });

  it("satisfies settlement net math: net === gross - refunds - fee", () => {
    const d = synthDemoData(GUIDE, SEED);
    const paymentsBySettlement = new Map<string, number[]>();
    for (const p of d.banking.pspPayments) {
      const list = paymentsBySettlement.get(p.settlementId) ?? [];
      list.push(p.amountCents);
      paymentsBySettlement.set(p.settlementId, list);
    }
    const refundsBySettlement = new Map<string, number>();
    for (const refund of d.core.refunds) {
      const payment = d.banking.pspPayments.find((p) => p.externalId === refund.paymentExternalId);
      if (!payment) continue;
      const sum = (refundsBySettlement.get(payment.settlementId) ?? 0) + refund.amountCents;
      refundsBySettlement.set(payment.settlementId, sum);
    }
    for (const s of d.banking.pspSettlements) {
      const gross = (paymentsBySettlement.get(s.externalId) ?? []).reduce((a, b) => a + b, 0);
      const refunds = refundsBySettlement.get(s.externalId) ?? 0;
      expect(s.amountCents).toBe(gross - refunds - s.feeCents);
    }
  });

  it("contains no real-data markers", () => {
    const d = synthDemoData(GUIDE, SEED);
    const blob = JSON.stringify(d).toLowerCase();
    for (const marker of REAL_MARKERS) {
      expect(blob).not.toContain(marker);
    }
    // Real Mollie ids use `tr_`/`stl_` underscore form; synthetic use hyphen.
    expect(blob).not.toMatch(/tr_[a-z0-9]{8,}/);
    expect(blob).not.toMatch(/stl_[a-z0-9]{5,}/);
  });

  it("references only numbered invoices from psp_payments", () => {
    const d = synthDemoData(GUIDE, SEED);
    const numbered = new Set(
      d.core.invoices.filter((inv) => inv.number !== null).map((inv) => inv.number!),
    );
    for (const p of d.banking.pspPayments) {
      expect(numbered.has(p.invoiceNumber)).toBe(true);
    }
  });

  it("links every refund to a refunded PSP payment", () => {
    const d = synthDemoData(GUIDE, SEED);
    const refunded = new Set(
      d.banking.pspPayments.filter((p) => p.status === "refunded").map((p) => p.externalId),
    );
    for (const refund of d.core.refunds) {
      expect(refunded.has(refund.paymentExternalId)).toBe(true);
    }
  });

  it("links every core PSP payment to a settlement and a matching psp_payment", () => {
    const d = synthDemoData(GUIDE, SEED);
    const settlementIds = new Set(d.banking.pspSettlements.map((s) => s.externalId));
    const pspById = new Map(d.banking.pspPayments.map((p) => [p.externalId, p]));
    for (const payment of d.core.payments) {
      if (payment.settlementId === null) continue;
      expect(settlementIds.has(payment.settlementId)).toBe(true);
      const psp = pspById.get(payment.externalId!);
      expect(psp).toBeDefined();
      expect(psp!.settlementId).toBe(payment.settlementId);
      expect(psp!.amountCents).toBe(payment.amountCents);
    }
  });
});

describe("makeIban", () => {
  it("produces valid NL IBANs for each bank code", () => {
    for (const code of ["RABO", "KNAB", "SNSB", "INGB", "ASNB"]) {
      const iban = makeIban(() => 0.5, code);
      expect(iban.startsWith(`NL`)).toBe(true);
      expect(iban.slice(4, 8)).toBe(code);
      expect(isValidNlIban(iban)).toBe(true);
    }
  });
});
