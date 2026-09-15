import { sql } from "kysely";
import { db } from "../kysely/index.js";

// Deterministic E2E fixture for the banking proxy (consumed by
// packages/api/tests/e2e/banking-proxy.spec.ts). The api container reads these
// rows over tRPC using the key from config.test.json (BANKING_API_KEY).

export const TEST_ACCOUNTS = {
  knab: {
    externalId: "knab-acc",
    aspspName: "Knab",
    aspspCountry: "NL",
    currency: "EUR",
    iban: "NL20KNAB0123456780",
    displayName: "Knab betaalrekening",
  },
  rabobank: {
    externalId: "rabobank-acc",
    aspspName: "Rabobank",
    aspspCountry: "NL",
    currency: "EUR",
    iban: "NL78RABO9876543210",
    displayName: "Rabobank betaalrekening",
  },
} as const;

/**
 * The credit that strict-matches the E2E invoice (amount + reference + window).
 * The E2E creates an OPEN invoice with a number prefix whose next number is
 * `2026-1`, total €42.00, dueDate ≈ bookingDate + 2 days.
 */
export const TEST_STRICT_MATCH_CREDIT = {
  externalId: "seed-credit-001",
  amountCents: 4200,
  currency: "EUR",
  creditDebit: "CRDT",
  status: "BOOK",
  bookingDate: "2026-08-10",
  remittanceInformation: "2026-1",
  counterpartyName: "E2E Client",
  counterpartyIban: "NL81CLNT0123456789",
} as const;

export const seedTest = async (): Promise<void> => {
  const knab = TEST_ACCOUNTS.knab;
  const rabobank = TEST_ACCOUNTS.rabobank;

  const upsertAccount = async (account: {
    externalId: string;
    aspspName: string;
    aspspCountry: string;
    currency: string;
    iban: string;
    displayName: string;
  }) => {
    const values = {
      externalId: account.externalId,
      aspspName: account.aspspName,
      aspspCountry: account.aspspCountry,
      currency: account.currency,
      accountType: "CACC",
      bic: null,
      iban: account.iban,
      bban: null,
      ownerName: "E2E Owner",
      accountName: "Current",
      product: "Betaalrekening",
      displayName: account.displayName,
      needsReconnect: false,
      syncedAt: new Date(),
    };
    await db
      .insertInto("accounts")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("externalId").doUpdateSet({
          displayName: account.displayName,
          needsReconnect: false,
          syncedAt: new Date(),
        }),
      )
      .execute();
    return db
      .selectFrom("accounts")
      .select("id")
      .where("externalId", "=", account.externalId)
      .executeTakeFirstOrThrow();
  };

  const knabRow = await upsertAccount(knab);
  const rabobankRow = await upsertAccount(rabobank);

  // knab: parked RequiresReauth connection (keeps the review-queue demo
  // deterministic — the worker skips it, the router still lists it; the E2E
  // specs toggle the status themselves), two review-queue credits + noise.
  await db
    .insertInto("connections")
    .values([
      {
        externalId: "conn-knab",
        aspspName: "Knab",
        aspspCountry: "NL",
        status: "Active",
        validUntil: "2099-01-01T00:00:00Z",
        accountCount: 1,
        lastSyncedAt: null,
        psuType: "Business",
      },
      {
        externalId: "conn-rabobank",
        aspspName: "Rabobank",
        aspspCountry: "NL",
        status: "Active",
        validUntil: "2099-01-01T00:00:00Z",
        accountCount: 1,
        lastSyncedAt: null,
        psuType: "Business",
      },
    ])
    .onConflict((conflict) => conflict.column("externalId").doNothing())
    .execute();

  const credit = TEST_STRICT_MATCH_CREDIT;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await db
    .insertInto("transactions")
    .values([
      {
        accountId: knabRow.id,
        externalId: credit.externalId,
        currency: credit.currency,
        creditDebit: credit.creditDebit,
        status: credit.status,
        bookingDate: credit.bookingDate,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: credit.amountCents,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: credit.counterpartyName,
        debtorIban: credit.counterpartyIban,
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: credit.remittanceInformation,
        note: null,
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      {
        accountId: knabRow.id,
        externalId: "seed-credit-002",
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: yesterday,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: 5000,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: "Demo Klant",
        debtorIban: "NL52DEMO0000000001",
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: "FACTUUR 2026-1",
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      {
        accountId: knabRow.id,
        externalId: "seed-credit-003",
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: yesterday,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: 3000,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: "Demo Klant",
        debtorIban: "NL52DEMO0000000001",
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: "FACTUUR 2026-2",
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      {
        accountId: rabobankRow.id,
        externalId: "seed-credit-004",
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: yesterday,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: 2500,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: "Demo Klant",
        debtorIban: "NL52DEMO0000000001",
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: "FACTUUR 2026-3",
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      {
        accountId: knabRow.id,
        externalId: "seed-credit-005",
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: yesterday,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        // Overpay split toward D (€45 for a €40 invoice).
        amountCents: 4500,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: "Demo Klant",
        debtorIban: "NL52DEMO0000000001",
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: "FACTUUR 2026-4",
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      {
        accountId: knabRow.id,
        externalId: "seed-noise-001",
        currency: "EUR",
        creditDebit: "DBIT",
        status: "BOOK",
        bookingDate: "2026-08-05",
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: -1999,
        creditorName: "Supermarkt",
        creditorIban: "NL56SUPM0123456789",
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: null,
        debtorIban: null,
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: null,
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      {
        // PSP lump-sum payout demo: matches the seeded Mollie settlement
        // setl-seed-001 (net 42.00) so the overview proposes a PSP reconcile.
        accountId: knabRow.id,
        externalId: "seed-credit-006",
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: yesterday,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: 4200,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: "Mollie B.V.",
        debtorIban: "NL66MOLLIE0000000000",
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: "MOLLIE PAYOUT",
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      {
        // Multi-invoice demo: 80.00 covers open invoices D (40.00) + F (40.00)
        // in one link (no invoice-number hit → subset-sum suggestion). Invoice C
        // stays free for the banking-proxy worker strict-match demo.
        accountId: knabRow.id,
        externalId: "seed-credit-007",
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: yesterday,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: 8000,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: "Demo Klant",
        debtorIban: "NL52DEMO0000000001",
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: "Geen factuurnummer",
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      // 008: Mollie settlement 201 payout (matches setl-seed-201)
      {
        accountId: knabRow.id,
        externalId: "seed-credit-008",
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: yesterday,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: 43373,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: "Mollie B.V.",
        debtorIban: "NL66MOLLIE0000000000",
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: "MOLLIE SETTLEMENT 201",
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      // 009: Mollie settlement 202 payout (matches setl-seed-202)
      {
        accountId: knabRow.id,
        externalId: "seed-credit-009",
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: yesterday,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: 32626,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: "Mollie B.V.",
        debtorIban: "NL66MOLLIE0000000000",
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: "MOLLIE SETTLEMENT 202",
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      // 010: Demo invoice for split-partial picker test (H=129.00)
      {
        accountId: knabRow.id,
        externalId: "seed-credit-010",
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: yesterday,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: 4500,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: "Demo Klant",
        debtorIban: "NL52DEMO0000000001",
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: "FACTUUR 2026-8",
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
      // 011: Multi-candidate adoption demo — two paid €130 invoices (M/N,
      // 2026-13/14) on the demo client; this credit names N explicitly
      // (note → ref hit) while M is only surname-tied (payer Jane Doe), so the
      // link dialog shows two rows sorted N (98%) above M (75%).
      {
        accountId: knabRow.id,
        externalId: "seed-credit-011",
        currency: "EUR",
        creditDebit: "CRDT",
        status: "BOOK",
        bookingDate: yesterday,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: 13000,
        creditorName: null,
        creditorIban: null,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: "Jane Doe",
        debtorIban: "NL52DEMO0000000001",
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: null,
        note: "FACTUUR 2026-14",
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      },
    ])
    .onConflict((conflict) => conflict.columns(["accountId", "externalId"]).doNothing())
    .execute();

  await db
    .insertInto("balances")
    .values([
      {
        accountId: knabRow.id,
        type: "ITBD",
        name: null,
        amountCents: 500000,
        currency: "EUR",
        referenceDate: "2026-08-10",
      },
      {
        accountId: rabobankRow.id,
        type: "ITBD",
        name: null,
        amountCents: 0,
        currency: "EUR",
        referenceDate: "2026-08-10",
      },
    ])
    .onConflict((conflict) =>
      conflict.columns(["accountId", "type"]).doUpdateSet({
        amountCents: 500000,
        referenceDate: "2026-08-10",
      }),
    )
    .execute();

  // PSP payout history is part of the same deterministic seed — awaited so
  // `seed:test` only exits once the fixture is fully written.
  await seedPspFixture();
  console.log(
    `[seed:test] banking proxy seeded: accounts=${2} connections=${2} transactions=${8} balances=${2} pspSettlements=${1} pspPayments=${1}`,
  );
};

// PSP payout history fixture (idempotent): one Mollie settlement whose net
// equals the seed-credit-006 credit, plus its payment mapped onto invoice E's
// checkout.payments row (seeded by the api's seed:test). Inserted after the
// balances so a re-seed keeps history idempotent.
const seedPspFixture = async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Invoice E's uuid — the checkout plugin stores it as the PSP payment's
  // description, so the settlement drill-down resolves the payment to its
  // invoice via the description (the external id deliberately differs from
  // checkout.payments.externalId to exercise that seam).
  // checkout.* lives in the shared slimfact DB (api schema) — the proxy's
  // kysely types only cover open_banking, so query it raw. The api container
  // seeds checkout.invoices at ITS boot, so retry briefly to absorb the boot
  // order (compose now waits on the api's health, this is belt-and-braces).
  let invoiceEUuid: string | null = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const rows = await sql<{ uuid: string }>`select uuid from "checkout"."invoices"
      where "number_prefix" = '2026-' and "number" = 5
      limit 1`.execute(db);
    if (rows.rows[0]) {
      invoiceEUuid = rows.rows[0].uuid;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await db
    .insertInto("psp_settlements")
    .values({
      externalId: "setl-seed-001",
      psp: "mollie",
      amountCents: 4200,
      feeCents: 0,
      currency: "EUR",
      payoutDate: yesterday,
      status: "paidout",
      syncedAt: new Date(),
      metadata: JSON.stringify({ reference: "SET-SEED-1" }),
    })
    .onConflict((conflict) =>
      conflict.column("externalId").doUpdateSet({
        psp: "mollie",
        amountCents: 4200,
        feeCents: 0,
        currency: "EUR",
        payoutDate: yesterday,
        status: "paidout",
        syncedAt: new Date(),
      }),
    )
    .execute();
  await db
    .insertInto("psp_payments")
    .values({
      psp: "mollie",
      externalId: "tr-seed-1",
      settlementId: "setl-seed-001",
      amountCents: 4200,
      currency: "EUR",
      description: invoiceEUuid ?? null,
      status: "paid",
      paidAt: new Date(),
      syncedAt: new Date(),
    })
    .onConflict((conflict) =>
      conflict.columns(["psp", "externalId"]).doUpdateSet({
        settlementId: "setl-seed-001",
        amountCents: 4200,
        currency: "EUR",
        description: invoiceEUuid ?? null,
        status: "paid",
        paidAt: new Date(),
        syncedAt: new Date(),
      }),
    )
    .execute();
  // --- Settlements 201–203 (extended demo for picker / settlement drill-down) ---
  // Query checkout.invoices raw (same pattern as the E fixture above).
  const uuidRetryLoop = async (numbers: number[], retryMs = 1000, retries = 3) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const results: (string | null)[] = [];
        for (const num of numbers) {
          const rows = await sql<{ uuid: string }>`select uuid from "checkout"."invoices"
            where "number_prefix" = '2026-' and "number" = ${num}
            limit 1
          `.execute(db);
          results.push(rows.rows[0]?.uuid ?? null);
        }
        return results;
      } catch {
        if (attempt < retries - 1) await new Promise((resolve) => setTimeout(resolve, retryMs));
      }
    }
    return numbers.map(() => null);
  };

  const [invoiceJUuid, invoiceKUuid, invoiceLUuid] = await uuidRetryLoop([10, 11, 12]);

  await db
    .insertInto("psp_settlements")
    .values([
      {
        psp: "mollie",
        externalId: "setl-seed-201",
        amountCents: 43473,
        feeCents: 897,
        currency: "EUR",
        payoutDate: yesterday,
        status: "paid_out",
        syncedAt: new Date(),
        metadata: null,
      },
      {
        psp: "mollie",
        externalId: "setl-seed-202",
        amountCents: 32626,
        feeCents: 674,
        currency: "EUR",
        payoutDate: yesterday,
        status: "open",
        syncedAt: new Date(),
        metadata: null,
      },
      {
        psp: "mollie",
        externalId: "setl-seed-203",
        amountCents: 3000,
        feeCents: 90,
        currency: "EUR",
        payoutDate: yesterday,
        status: "failed",
        syncedAt: new Date(),
        metadata: null,
      },
    ])
    .onConflict((conflict) =>
      conflict.column("externalId").doUpdateSet({
        amountCents: (eb) => eb.ref("excluded.amountCents"),
        feeCents: (eb) => eb.ref("excluded.feeCents"),
        status: (eb) => eb.ref("excluded.status"),
      }),
    )
    .execute();

  await db
    .insertInto("psp_payments")
    .values([
      {
        psp: "mollie",
        externalId: "tr-201-1",
        settlementId: "setl-seed-201",
        amountCents: 34581,
        currency: "EUR",
        description: invoiceJUuid ?? "pay-seed-201-1",
        status: "paid",
        paidAt: new Date(),
        syncedAt: new Date(),
      },
      {
        psp: "mollie",
        externalId: "tr-201-2",
        settlementId: "setl-seed-201",
        amountCents: 1290,
        currency: "EUR",
        description: invoiceKUuid ?? "pay-seed-201-2",
        status: "paid",
        paidAt: new Date(),
        syncedAt: new Date(),
      },
      {
        psp: "mollie",
        externalId: "tr-201-3",
        settlementId: "setl-seed-201",
        amountCents: 5000,
        currency: "EUR",
        description: null,
        status: "paid",
        paidAt: new Date(),
        syncedAt: new Date(),
      },
      {
        psp: "mollie",
        externalId: "tr-201-4",
        settlementId: "setl-seed-201",
        amountCents: 3499,
        currency: "EUR",
        description: null,
        status: "paid",
        paidAt: new Date(),
        syncedAt: new Date(),
      },
    ])
    .onConflict((conflict) =>
      conflict.columns(["psp", "externalId"]).doUpdateSet({
        settlementId: "setl-seed-201",
      }),
    )
    .execute();

  await db
    .insertInto("psp_payments")
    .values([
      {
        psp: "mollie",
        externalId: "tr-202-1",
        settlementId: "setl-seed-202",
        amountCents: 19900,
        currency: "EUR",
        description: invoiceLUuid ?? "pay-seed-202-1",
        status: "paid",
        paidAt: new Date(),
        syncedAt: new Date(),
      },
      {
        psp: "mollie",
        externalId: "tr-202-2",
        settlementId: "setl-seed-202",
        amountCents: 8900,
        currency: "EUR",
        description: null,
        status: "paid",
        paidAt: new Date(),
        syncedAt: new Date(),
      },
      {
        psp: "mollie",
        externalId: "tr-202-3",
        settlementId: "setl-seed-202",
        amountCents: 4500,
        currency: "EUR",
        description: null,
        status: "refunded",
        paidAt: null,
        syncedAt: new Date(),
      },
    ])
    .onConflict((conflict) =>
      conflict.columns(["psp", "externalId"]).doUpdateSet({
        settlementId: "setl-seed-202",
      }),
    )
    .execute();
};

seedTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
