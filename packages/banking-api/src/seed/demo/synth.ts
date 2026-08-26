// Pure synthetic demo-data generator for the banking-api + api seeds.
//
// Deliberately free of I/O and live-data dependencies: it turns a hardcoded
// `DemoGuide` (distributions observed from the production dump / live Mollie /
// open-banking) plus a fixed seed into a fully synthetic in-memory dataset. No
// real name, IBAN, UUID, `tr_`/`stl_` id, or amount is ever echoed. The two
// committed fixtures (api `demoCore`, banking-api `demoBanking`) are produced
// by splitting the return value of `synthDemoData`.

export type DemoInvoiceStatus = "bill" | "receipt" | "open" | "paid" | "canceled";
export type DemoPaymentMethod = "ideal" | "creditcard" | "banktransfer" | "cash";

export interface DemoGuide {
  companyCount: number;
  clientCount: number;
  numberedInvoiceCount: number;
  unnumberedInvoiceCount: number;
  settlementCount: number;
  settlementPaymentCountRange: [number, number];
  settlementFeeFixedCents: number;
  settlementFeeRoundingCents: number;
  refundRate: number;
  invoiceAmountMedianCents: number;
  invoiceAmountMaxCents: number;
  amountSigma: number;
  methodMix: { ideal: number; creditcard: number; banktransfer: number; cash: number };
  invoiceStatusMix: { bill: number; receipt: number; paid: number; canceled: number; open: number };
  dateRange: { from: string; to: string };
}

export interface DemoCompany {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  cocNumber: string;
  iban: string;
  bic: string;
  prefix: string;
  vatIdNumber: string;
  emailBcc: string | null;
}
export interface DemoClient {
  companyName: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  contactPersonName: string;
}
export interface DemoNumberPrefix {
  name: string;
  template: string;
}
export interface DemoInvoice {
  companyIndex: number;
  clientIndex: number;
  amountCents: number;
  status: DemoInvoiceStatus;
  /** null for unnumbered BILL/RECEIPT documents. */
  number: number | null;
  numberPrefix: string | null;
  lineDescription: string;
  paymentTermDays: number;
  locale: string;
}
export interface DemoPayment {
  /** Index into `core.invoices`. */
  invoiceIndex: number;
  amountCents: number;
  method: DemoPaymentMethod;
  /** PSP external id (`tr-…`) — null for non-PSP payments. */
  externalId: string | null;
  /** Settlement id (`stl-…`) — null for non-PSP payments. */
  settlementId: string | null;
  description: string;
}
export interface DemoRefund {
  /** externalId of the PSP payment this refund reverses. */
  paymentExternalId: string;
  amountCents: number;
  externalId: string;
  description: string;
}
export interface DemoAccount {
  externalId: string;
  aspspName: string;
  aspspCountry: string;
  currency: string;
  iban: string;
  displayName: string;
  ownerName: string;
  accountName: string;
  product: string;
  needsReconnect: boolean;
}
export interface DemoConnection {
  externalId: string;
  aspspName: string;
  aspspCountry: string;
  status: string;
  validUntil: string;
  accountCount: number;
  psuType: string;
}
export interface DemoTransaction {
  accountIndex: number;
  externalId: string;
  currency: string;
  creditDebit: "CRDT" | "DBIT";
  status: string;
  bookingDate: string;
  amountCents: number;
  debtorName: string | null;
  debtorIban: string | null;
  creditorName: string | null;
  creditorIban: string | null;
  remittanceInformation: string | null;
  note: string | null;
}
export interface DemoBalance {
  accountIndex: number;
  type: string;
  amountCents: number;
  currency: string;
  referenceDate: string;
}
export interface DemoPspSettlement {
  externalId: string;
  psp: string;
  amountCents: number;
  feeCents: number;
  currency: string;
  payoutDate: string;
  status: string;
  metadata: Record<string, unknown> | null;
}
export interface DemoPspPayment {
  psp: string;
  externalId: string;
  settlementId: string;
  amountCents: number;
  currency: string;
  invoiceNumber: number;
  status: string;
  paidAt: string;
}
export interface DemoData {
  core: {
    companies: DemoCompany[];
    clients: DemoClient[];
    numberPrefixes: DemoNumberPrefix[];
    invoices: DemoInvoice[];
    payments: DemoPayment[];
    refunds: DemoRefund[];
  };
  banking: {
    accounts: DemoAccount[];
    connections: DemoConnection[];
    transactions: DemoTransaction[];
    balances: DemoBalance[];
    pspSettlements: DemoPspSettlement[];
    pspPayments: DemoPspPayment[];
  };
}

// ---------------------------------------------------------------------------
// PRNG + numeric helpers
// ---------------------------------------------------------------------------

/** Deterministic PRNG (same as packages/api/src/kysely/seeds/fake.ts). */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Standard-normal sample via Box–Muller. */
const gauss = (rng: () => number): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

const TOKEN_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const randToken = (rng: () => number, len = 10): string => {
  let s = "";
  for (let i = 0; i < len; i++) s += TOKEN_CHARS[Math.floor(rng() * TOKEN_CHARS.length)];
  return s;
};

const randomDate = (rng: () => number, range: { from: string; to: string }): string => {
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);
  return new Date(from + rng() * (to - from)).toISOString().slice(0, 10);
};

/** Valid NL IBAN (mod-97 check) for a 4-letter bank code. */
export const makeIban = (rng: () => number, bankCode: string): string => {
  const digits = Array.from({ length: 10 }, () => Math.floor(rng() * 10)).join("");
  const bban = bankCode + digits;
  const rearranged = bban + "NL00";
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  const check = 98n - (BigInt(numeric) % 97n);
  return `NL${String(check).padStart(2, "0")}${bban}`;
};

const amountDraw = (rng: () => number, guide: DemoGuide): number => {
  const raw = Math.round(guide.invoiceAmountMedianCents * Math.exp(gauss(rng) * guide.amountSigma));
  return Math.min(guide.invoiceAmountMaxCents, Math.max(100, raw));
};

// ---------------------------------------------------------------------------
// Fictional value pools (never real data)
// ---------------------------------------------------------------------------

const COMPANY_POOL: Array<Omit<DemoCompany, "iban" | "bic">> = [
  {
    name: "Bouwhuis & Partners BV",
    address: "Kanaaldijk 12",
    postalCode: "1011 AB",
    city: "Amsterdam",
    country: "NL",
    email: "info@bouwhuis.example",
    cocNumber: "12345678",
    prefix: "bouwhuis",
    vatIdNumber: "NL123456789B01",
    emailBcc: null,
  },
  {
    name: "Noordzee Techniek BV",
    address: "Havenstraat 4",
    postalCode: "2011 AC",
    city: "Haarlem",
    country: "NL",
    email: "info@noordzee.example",
    cocNumber: "23456789",
    prefix: "noordzee",
    vatIdNumber: "NL234567890B02",
    emailBcc: null,
  },
  {
    name: "Hollandia Dakwerken BV",
    address: "Dijkweg 8",
    postalCode: "3011 AD",
    city: "Rotterdam",
    country: "NL",
    email: "info@hollandia.example",
    cocNumber: "34567890",
    prefix: "hollandia",
    vatIdNumber: "NL345678901B03",
    emailBcc: null,
  },
];

const CLIENT_POOL: DemoClient[] = [
  {
    companyName: "De Vries Hoveniers",
    address: "Tuinlaan 3",
    postalCode: "1012 AE",
    city: "Amsterdam",
    country: "NL",
    email: "info@devries.example",
    contactPersonName: "Jan de Vries",
  },
  {
    companyName: "Van Dijk Elektra",
    address: "Stroomweg 7",
    postalCode: "1013 AF",
    city: "Amsterdam",
    country: "NL",
    email: "info@vandijk.example",
    contactPersonName: "Piet van Dijk",
  },
  {
    companyName: "Bakker & Zonen",
    address: "Bakkerstraat 9",
    postalCode: "1014 AG",
    city: "Amsterdam",
    country: "NL",
    email: "info@bakker.example",
    contactPersonName: "Kees Bakker",
  },
  {
    companyName: "Jansen Tuinbouw",
    address: "Kaslaan 11",
    postalCode: "1015 AH",
    city: "Amsterdam",
    country: "NL",
    email: "info@jansen.example",
    contactPersonName: "Marijke Jansen",
  },
  {
    companyName: "Smit Bouwservice",
    address: "Bouwstraat 15",
    postalCode: "1016 AJ",
    city: "Amsterdam",
    country: "NL",
    email: "info@smit.example",
    contactPersonName: "Henk Smit",
  },
  {
    companyName: "Mulder Interieur",
    address: "Meubelhof 2",
    postalCode: "1017 AK",
    city: "Amsterdam",
    country: "NL",
    email: "info@mulder.example",
    contactPersonName: "Els Mulder",
  },
  {
    companyName: "Visser Loodgieters",
    address: "Waterweg 5",
    postalCode: "1018 AL",
    city: "Amsterdam",
    country: "NL",
    email: "info@visser.example",
    contactPersonName: "Wim Visser",
  },
  {
    companyName: "Kok Verwarming",
    address: "Warmtestraat 8",
    postalCode: "1019 AM",
    city: "Amsterdam",
    country: "NL",
    email: "info@kok.example",
    contactPersonName: "Gerda Kok",
  },
  {
    companyName: "Meijer Dakbedekking",
    address: "Daklaan 13",
    postalCode: "1020 AN",
    city: "Amsterdam",
    country: "NL",
    email: "info@meijer.example",
    contactPersonName: "Rob Meijer",
  },
  {
    companyName: "Hendriks Schilders",
    address: "Verfstraat 17",
    postalCode: "1021 AP",
    city: "Amsterdam",
    country: "NL",
    email: "info@hendriks.example",
    contactPersonName: "Anja Hendriks",
  },
  {
    companyName: "Van Leeuwen Timmerwerk",
    address: "Houtlaan 21",
    postalCode: "1022 AQ",
    city: "Amsterdam",
    country: "NL",
    email: "info@vanleeuwen.example",
    contactPersonName: "Dirk van Leeuwen",
  },
  {
    companyName: "De Boer Metselwerk",
    address: "Steenweg 24",
    postalCode: "1023 AR",
    city: "Amsterdam",
    country: "NL",
    email: "info@deboer.example",
    contactPersonName: "Niels de Boer",
  },
  {
    companyName: "Vos Beton",
    address: "Betonstraat 27",
    postalCode: "1024 AS",
    city: "Amsterdam",
    country: "NL",
    email: "info@vos.example",
    contactPersonName: "Sanne Vos",
  },
  {
    companyName: "Peters Stucwerk",
    address: "Pleisterlaan 30",
    postalCode: "1025 AT",
    city: "Amsterdam",
    country: "NL",
    email: "info@peters.example",
    contactPersonName: "Bart Peters",
  },
];

const LINE_POOL = [
  "Consultancy services",
  "Installation work",
  "Maintenance contract",
  "Materials and supplies",
  "Design services",
  "Repair work",
  "Cleaning services",
  "Transport and logistics",
  "Software license",
  "Training session",
];

const NOISE_CREDITORS = [
  "Supermarkt",
  "Energiebedrijf",
  "Telecom",
  "Verzekering",
  "Kantoorartikelen",
];
// ---------------------------------------------------------------------------
// Synthesis
// ---------------------------------------------------------------------------

/** Weighted draw among the numbered-invoice statuses (paid/canceled/open). */
const drawNumberedStatus = (
  rng: () => number,
  mix: DemoGuide["invoiceStatusMix"],
): DemoInvoiceStatus => {
  const total = mix.paid + mix.canceled + mix.open;
  const roll = rng() * total;
  if (roll < mix.paid) return "paid";
  if (roll < mix.paid + mix.canceled) return "canceled";
  return "open";
};

/** Settlement status: mostly paidout, some open/failed (only paidout pays out). */
const drawSettlementStatus = (rng: () => number): string => {
  const roll = rng();
  if (roll < 0.8) return "paidout";
  if (roll < 0.95) return "open";
  return "failed";
};

/**
 * Produce the full synthetic dataset from a hardcoded guide + fixed seed.
 * Pure: no I/O, no UUIDs (those are left to the DB at seed time), fully
 * deterministic for a given (guide, seed).
 */
export const synthDemoData = (guide: DemoGuide, seed: number): DemoData => {
  const rng = mulberry32(seed);

  // --- Accounts (own bank accounts; company 0 owns both via IBAN fallback) ---
  const accounts: DemoAccount[] = [
    {
      externalId: "acc-knab",
      aspspName: "Knab",
      aspspCountry: "NL",
      currency: "EUR",
      iban: makeIban(rng, "KNAB"),
      displayName: "Knab betaalrekening",
      ownerName: "Bouwhuis & Partners BV",
      accountName: "Current",
      product: "Betaalrekening",
      needsReconnect: false,
    },
    {
      externalId: "acc-rabo",
      aspspName: "Rabobank",
      aspspCountry: "NL",
      currency: "EUR",
      iban: makeIban(rng, "RABO"),
      displayName: "Rabobank betaalrekening",
      ownerName: "Bouwhuis & Partners BV",
      accountName: "Current",
      product: "Betaalrekening",
      needsReconnect: false,
    },
  ];

  // --- Companies (company 0/1 IBANs match the two accounts for the fallback) ---
  const companies: DemoCompany[] = COMPANY_POOL.map((c, i) => ({
    ...c,
    iban: i < accounts.length ? accounts[i].iban : makeIban(rng, "SNSB"),
    bic: i === 0 ? "KNABNL2H" : i === 1 ? "RABONL2U" : "SNSBNL2A",
  }));

  // --- Clients ---
  const clients: DemoClient[] = CLIENT_POOL.slice(0, guide.clientCount);

  const numberPrefixes: DemoNumberPrefix[] = [{ name: "2026-", template: "2026-" }];

  // --- Invoices: numbered (company 0, prefix 2026-) + unnumbered (BILL/RECEIPT) ---
  const numberedInvoices: DemoInvoice[] = [];
  for (let i = 1; i <= guide.numberedInvoiceCount; i++) {
    numberedInvoices.push({
      companyIndex: 0,
      clientIndex: Math.floor(rng() * guide.clientCount),
      amountCents: amountDraw(rng, guide),
      status: drawNumberedStatus(rng, guide.invoiceStatusMix),
      number: i,
      numberPrefix: "2026-",
      lineDescription: pick(rng, LINE_POOL),
      paymentTermDays: 14,
      locale: "en-US",
    });
  }
  const receiptShare =
    guide.invoiceStatusMix.receipt / (guide.invoiceStatusMix.bill + guide.invoiceStatusMix.receipt);
  const unnumberedInvoices: DemoInvoice[] = [];
  for (let i = 0; i < guide.unnumberedInvoiceCount; i++) {
    unnumberedInvoices.push({
      companyIndex: Math.floor(rng() * guide.companyCount),
      clientIndex: Math.floor(rng() * guide.clientCount),
      amountCents: amountDraw(rng, guide),
      status: rng() < receiptShare ? "receipt" : "bill",
      number: null,
      numberPrefix: null,
      lineDescription: pick(rng, LINE_POOL),
      paymentTermDays: 14,
      locale: "en-US",
    });
  }
  const invoices = [...numberedInvoices, ...unnumberedInvoices];
  const indexByNumber = new Map<number, number>();
  numberedInvoices.forEach((inv, i) => indexByNumber.set(inv.number!, i));

  // --- PSP payments + settlements (refund-aware net math) ---
  const paidNumbers = numberedInvoices
    .filter((inv) => inv.status === "paid")
    .map((inv) => inv.number!);
  const paidByNumber = new Map(
    numberedInvoices.filter((inv) => inv.status === "paid").map((inv) => [inv.number!, inv]),
  );
  const pspPayments: DemoPspPayment[] = [];
  const pspCorePayments: DemoPayment[] = [];
  const settlements: DemoPspSettlement[] = [];
  const refunds: DemoRefund[] = [];
  const transactions: DemoTransaction[] = [];
  let cursor = 0;

  for (let s = 0; s < guide.settlementCount; s++) {
    const k =
      guide.settlementPaymentCountRange[0] +
      Math.floor(
        rng() * (guide.settlementPaymentCountRange[1] - guide.settlementPaymentCountRange[0] + 1),
      );
    const stlId = `stl-${randToken(rng)}`;
    const chunk: DemoPspPayment[] = [];
    const chunkCore: DemoPayment[] = [];
    for (let j = 0; j < k; j++) {
      const num = paidNumbers[cursor % Math.max(1, paidNumbers.length)];
      cursor++;
      const inv = paidByNumber.get(num)!;
      const amount = Math.max(1, Math.round(inv.amountCents * (0.2 + rng() * 0.8)));
      const method: DemoPaymentMethod = rng() < guide.methodMix.ideal ? "ideal" : "creditcard";
      const externalId = `tr-${randToken(rng)}`;
      chunk.push({
        psp: "mollie",
        externalId,
        settlementId: stlId,
        amountCents: amount,
        currency: "EUR",
        invoiceNumber: num,
        status: "paid",
        paidAt: randomDate(rng, guide.dateRange),
      });
      chunkCore.push({
        invoiceIndex: indexByNumber.get(num)!,
        amountCents: amount,
        method,
        externalId,
        settlementId: stlId,
        description: `Mollie payout ${num}`,
      });
    }
    let refundSum = 0;
    for (const p of chunk) {
      if (rng() < guide.refundRate) {
        const refundAmount = Math.max(1, Math.round(p.amountCents * (0.1 + rng() * 0.9)));
        refundSum += refundAmount;
        p.status = "refunded";
        refunds.push({
          paymentExternalId: p.externalId,
          amountCents: refundAmount,
          externalId: `re-${randToken(rng)}`,
          description: "Refund",
        });
      }
    }
    const gross = chunk.reduce((a, b) => a + b.amountCents, 0);
    const fee = (guide.settlementFeeFixedCents + guide.settlementFeeRoundingCents) * chunk.length;
    const net = gross - refundSum - fee;
    const status = drawSettlementStatus(rng);
    settlements.push({
      externalId: stlId,
      psp: "mollie",
      amountCents: net,
      feeCents: fee,
      currency: "EUR",
      payoutDate: randomDate(rng, guide.dateRange),
      status,
      metadata: null,
    });
    if (status === "paidout") {
      transactions.push({
        accountIndex: 0,
        externalId: `tx-${randToken(rng)}`,
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: randomDate(rng, guide.dateRange),
        amountCents: net,
        debtorName: "Mollie B.V.",
        debtorIban: "NL66MOLLIE0000000000",
        creditorName: null,
        creditorIban: null,
        remittanceInformation: null,
        note: "MOLLIE PAYOUT",
      });
    }
    pspPayments.push(...chunk);
    pspCorePayments.push(...chunkCore);
  }

  // --- Non-PSP payments: receipts paid via bank transfer ---
  const corePayments: DemoPayment[] = [...pspCorePayments];
  invoices.forEach((inv, i) => {
    if (inv.status === "receipt") {
      corePayments.push({
        invoiceIndex: i,
        amountCents: inv.amountCents,
        method: "banktransfer",
        externalId: null,
        settlementId: null,
        description: "Bank transfer",
      });
    }
  });

  // --- Bank transactions: customer credits (invoice refs) + noise debits ---
  const customerCreditCount = Math.floor(guide.settlementCount * 0.3);
  for (let c = 0; c < customerCreditCount; c++) {
    const inv = numberedInvoices[Math.floor(rng() * numberedInvoices.length)];
    transactions.push({
      accountIndex: Math.floor(rng() * accounts.length),
      externalId: `tx-${randToken(rng)}`,
      currency: "EUR",
      creditDebit: "CRDT",
      status: "BOOK",
      bookingDate: randomDate(rng, guide.dateRange),
      amountCents: inv.amountCents,
      debtorName: clients[inv.clientIndex].companyName,
      debtorIban: makeIban(rng, "INGB"),
      creditorName: null,
      creditorIban: null,
      remittanceInformation: `${inv.numberPrefix}${inv.number}`,
      note: null,
    });
  }
  for (let c = 0; c < 5; c++) {
    transactions.push({
      accountIndex: Math.floor(rng() * accounts.length),
      externalId: `tx-${randToken(rng)}`,
      currency: "EUR",
      creditDebit: "DBIT",
      status: "BOOK",
      bookingDate: randomDate(rng, guide.dateRange),
      amountCents: -Math.round(100 + rng() * 5000),
      debtorName: null,
      debtorIban: null,
      creditorName: pick(rng, NOISE_CREDITORS),
      creditorIban: makeIban(rng, "INGB"),
      remittanceInformation: null,
      note: null,
    });
  }

  // --- Balances + connections ---
  const balances: DemoBalance[] = accounts.map((_, i) => ({
    accountIndex: i,
    type: "ITBD",
    amountCents: 500000 + Math.floor(rng() * 500000),
    currency: "EUR",
    referenceDate: guide.dateRange.to,
  }));
  const connections: DemoConnection[] = accounts.map((acc, i) => ({
    externalId: `conn-${i === 0 ? "knab" : "rabo"}`,
    aspspName: acc.aspspName,
    aspspCountry: acc.aspspCountry,
    status: "Active",
    validUntil: "2099-01-01T00:00:00Z",
    accountCount: 1,
    psuType: "Business",
  }));

  return {
    core: { companies, clients, numberPrefixes, invoices, payments: corePayments, refunds },
    banking: {
      accounts,
      connections,
      transactions,
      balances,
      pspSettlements: settlements,
      pspPayments,
    },
  };
};
