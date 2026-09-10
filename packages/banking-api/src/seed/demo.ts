import { sql } from "kysely";
import { db } from "../kysely/index.js";
import { demoBanking } from "@slimfact/tools/banking/demo/banking";

// Banking `seed:demo`: upserts the committed `demoBanking` fixture into the
// open_banking schema (idempotent via onConflict). The api container seeds
// checkout.invoices at ITS boot; the banking-api container boots after
// (depends_on api: service_healthy), so the invoice-number → uuid resolution
// below retries briefly to absorb any residual boot-order skew.

export const seedDemo = async (): Promise<void> => {
  const { accounts, connections, transactions, balances, pspSettlements, pspPayments } =
    demoBanking;

  // --- Accounts (upsert by externalId) ---
  const accountIds = new Map<number, number>();
  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    await db
      .insertInto("accounts")
      .values({
        externalId: acc.externalId,
        aspspName: acc.aspspName,
        aspspCountry: acc.aspspCountry,
        currency: acc.currency,
        accountType: "CACC",
        bic: null,
        iban: acc.iban,
        bban: null,
        ownerName: acc.ownerName,
        accountName: acc.accountName,
        product: acc.product,
        displayName: acc.displayName,
        needsReconnect: acc.needsReconnect,
        syncedAt: new Date(),
      })
      .onConflict((oc) =>
        oc.column("externalId").doUpdateSet({
          displayName: acc.displayName,
          needsReconnect: acc.needsReconnect,
          syncedAt: new Date(),
        }),
      )
      .execute();
    const row = await db
      .selectFrom("accounts")
      .select("id")
      .where("externalId", "=", acc.externalId)
      .executeTakeFirstOrThrow();
    accountIds.set(i, row.id);
  }

  // --- Connections (upsert by externalId) ---
  for (const conn of connections) {
    await db
      .insertInto("connections")
      .values({
        externalId: conn.externalId,
        aspspName: conn.aspspName,
        aspspCountry: conn.aspspCountry,
        status: conn.status,
        validUntil: conn.validUntil,
        accountCount: conn.accountCount,
        lastSyncedAt: null,
        psuType: conn.psuType,
      })
      .onConflict((oc) => oc.column("externalId").doNothing())
      .execute();
  }

  // --- Transactions (upsert by accountId + externalId) ---
  for (const tx of transactions) {
    await db
      .insertInto("transactions")
      .values({
        accountId: accountIds.get(tx.accountIndex)!,
        externalId: tx.externalId,
        currency: tx.currency,
        creditDebit: tx.creditDebit,
        status: tx.status,
        bookingDate: tx.bookingDate,
        valueDate: null,
        transactionDate: null,
        bankTransactionCode: null,
        amountCents: tx.amountCents,
        creditorName: tx.creditorName,
        creditorIban: tx.creditorIban,
        creditorBban: null,
        creditorAgentBic: null,
        debtorName: tx.debtorName,
        debtorIban: tx.debtorIban,
        debtorBban: null,
        debtorAgentBic: null,
        remittanceInformation: tx.remittanceInformation,
        note: tx.note,
        referenceNumber: null,
        exchangeRate: null,
        merchantCategoryCode: null,
        balanceAfterTransactionCents: null,
        balanceAfterCurrency: null,
      })
      .onConflict((oc) => oc.columns(["accountId", "externalId"]).doNothing())
      .execute();
  }

  // --- Balances (upsert by accountId + type) ---
  for (const bal of balances) {
    await db
      .insertInto("balances")
      .values({
        accountId: accountIds.get(bal.accountIndex)!,
        type: bal.type,
        name: null,
        amountCents: bal.amountCents,
        currency: bal.currency,
        referenceDate: bal.referenceDate,
      })
      .onConflict((oc) =>
        oc.columns(["accountId", "type"]).doUpdateSet({
          amountCents: bal.amountCents,
          referenceDate: bal.referenceDate,
        }),
      )
      .execute();
  }

  // --- PSP settlements (upsert by externalId) ---
  for (const s of pspSettlements) {
    await db
      .insertInto("psp_settlements")
      .values({
        externalId: s.externalId,
        psp: s.psp,
        amountCents: s.amountCents,
        feeCents: s.feeCents,
        currency: s.currency,
        payoutDate: s.payoutDate,
        status: s.status,
        syncedAt: new Date(),
        metadata: s.metadata ? JSON.stringify(s.metadata) : null,
      })
      .onConflict((oc) =>
        oc.column("externalId").doUpdateSet({
          amountCents: s.amountCents,
          feeCents: s.feeCents,
          status: s.status,
          syncedAt: new Date(),
        }),
      )
      .execute();
  }

  // --- PSP payments (upsert by psp + externalId); description = invoice uuid ---
  for (const p of pspPayments) {
    const description = await resolveInvoiceUuid(p.invoiceNumber);
    await db
      .insertInto("psp_payments")
      .values({
        psp: p.psp,
        externalId: p.externalId,
        settlementId: p.settlementId,
        amountCents: p.amountCents,
        currency: p.currency,
        description,
        status: p.status,
        paidAt: new Date(p.paidAt),
        syncedAt: new Date(),
      })
      .onConflict((oc) =>
        oc.columns(["psp", "externalId"]).doUpdateSet({
          settlementId: p.settlementId,
          amountCents: p.amountCents,
          description,
          status: p.status,
          syncedAt: new Date(),
        }),
      )
      .execute();
  }

  console.log(
    `[seed:demo] seeded ${accounts.length} accounts, ${connections.length} connections, ${transactions.length} transactions, ${balances.length} balances, ${pspSettlements.length} settlements, ${pspPayments.length} psp payments`,
  );
};

/**
 * Resolve an invoice number → checkout.invoices.uuid (the checkout plugin
 * stores the invoice uuid as the PSP payment description). The checkout.*
 * tables live in the shared slimfact DB; the proxy's kysely types only cover
 * open_banking, so this queries raw. Retries only while the table is missing
 * (api still booting); returns null when the invoice simply isn't there.
 */
const resolveInvoiceUuid = async (number: number): Promise<string | null> => {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const rows = await sql<{ uuid: string }>`
        select uuid from "checkout"."invoices"
        where "number_prefix" = '2026-' and "number" = ${number}
        limit 1
      `.execute(db);
      return rows.rows[0]?.uuid ?? null;
    } catch {
      // Table/schema missing — api still booting; retry.
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return null;
};

// CLI entry: run when executed directly (node dist/src/seed/demo.js).
import { pathToFileURL } from "node:url";
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  seedDemo().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
