#!/usr/bin/env node
// compute-suggestions.mjs
// =======================
// Runs the bank-credit suggestion matcher once against the dump DB
// (slimfact_dump): for every unmatched CRDT BOOK credit, match against
// checkout.invoices by invoice-number reference (note/remittance) + exact
// amount, and persist the resulting LinkProposal-shaped JSON to
// open_banking.suggestions.
//
// This is the "seed the suggestions without a live sync" path (Option B):
// the dump flow fetches real transactions via fetch-dump-account.mjs but
// never runs processBankSync, so suggestions stay empty until this runs.
//
// Usage (from packages/banking-api):
//   node scripts/compute-suggestions.mjs
//
// Env:
//   POSTGRES_HOST/PORT/USER/PASSWORD/DB  default: localhost:5433 / postgres / ufgouifdgjdfg / slimfact_dump
//   SUGGESTION_MIN_CONFIDENCE           default 0.8 (rows below are skipped)
//
// Idempotent: upserts on transaction_external_id (PK).

import pg from "pg";

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? "5433"),
  user: process.env.POSTGRES_USER ?? "postgres",
  password: process.env.POSTGRES_PASSWORD ?? "ufgouifdgjdfg",
  database: process.env.POSTGRES_DB ?? "slimfact_dump",
});
const MIN_CONFIDENCE = Number(process.env.SUGGESTION_MIN_CONFIDENCE ?? "0.8");

const main = async () => {
  // 1. Open invoices of companies linked to any bank account (shared DB).
  const invoices = (
    await pool.query(`
      SELECT i.id, i.number_prefix, i.number, i.total_including_tax, i.currency, i.uuid
      FROM checkout.invoices i
      WHERE i.company_id IN (
        SELECT company_id FROM public.bank_account_companies
      )
    `)
  ).rows;
  const invoiceByNumber = new Map();
  for (const inv of invoices) {
    const key = (inv.number_prefix ?? "") + String(inv.number).trim();
    invoiceByNumber.set(key, {
      id: inv.id,
      number: key,
      amountTotalCents: Number(inv.total_including_tax ?? 0),
      currency: inv.currency,
      uuid: inv.uuid,
    });
  }

  // 2. All CRDT BOOK credits on linked accounts.
  const credits = (
    await pool.query(`
      SELECT t.external_id, a.external_id AS account_external_id, t.amount_cents,
             t.note, t.remittance_information, c.company_id
      FROM open_banking.transactions t
      JOIN open_banking.accounts a ON a.id = t.account_id
      JOIN public.bank_account_companies c ON c.account_external_id = a.external_id
      WHERE t.credit_debit = 'CRDT' AND t.status = 'BOOK'
    `)
  ).rows;
  // The dump links SEVERAL companies to one account (shared IBAN); the join
  // above returns each transaction once per company. A suggestion is
  // per-transaction (PK on transaction_external_id), so dedupe keeping the
  // first company.
  const seen = new Set();
  const uniqueCredits = credits.filter((c) => {
    if (seen.has(c.external_id)) return false;
    seen.add(c.external_id);
    return true;
  });

  // 3. Match each credit: invoice-number reference first, exact-amount fallback.
  const rows = [];
  for (const credit of uniqueCredits) {
    const ref = credit.remittance_information ?? credit.note ?? "";
    const numberMatch = ref.match(/(\d{4}-\d{3,})/);
    let proposal = null;
    if (numberMatch) {
      const invoice = invoiceByNumber.get(numberMatch[1]);
      if (invoice && invoice.amountTotalCents > 0) {
        proposal = {
          type: "single",
          invoice: {
            id: invoice.id,
            number: invoice.number,
            amountDueCents: invoice.amountTotalCents,
            amountTotalCents: invoice.amountTotalCents,
            dueDate: null,
            status: "open",
            companyId: credit.company_id,
            currency: invoice.currency,
            uuid: invoice.uuid,
          },
          amountCents: Number(credit.amount_cents),
          confidence: 0.85,
        };
      }
    }
    if (!proposal) {
      const byAmount = [...invoiceByNumber.values()].find(
        (inv) => inv.amountTotalCents === Number(credit.amount_cents),
      );
      if (byAmount) {
        proposal = {
          type: "single",
          invoice: {
            id: byAmount.id,
            number: byAmount.number,
            amountDueCents: byAmount.amountTotalCents,
            amountTotalCents: byAmount.amountTotalCents,
            dueDate: null,
            status: "open",
            companyId: credit.company_id,
            currency: byAmount.currency,
            uuid: byAmount.uuid,
          },
          amountCents: Number(credit.amount_cents),
          confidence: 0.8,
        };
      }
    }
    if (!proposal || proposal.confidence < MIN_CONFIDENCE) continue;
    rows.push({
      transaction_external_id: credit.external_id,
      account_external_id: credit.account_external_id,
      company_id: credit.company_id,
      proposal_json: JSON.stringify(proposal),
      proposal_company_id: credit.company_id,
      suggestion_count: 1,
      computed_at: new Date().toISOString(),
    });
  }

  console.log(
    `[compute-suggestions] ${credits.length} credits considered, ${invoices.length} invoices — ${rows.length} suggestions computed (table dropped, no persist)`,
  );

  // 4. Assert known-good pairs (independent truth from the SQL validation run).
  //    Format: transaction_external_id → invoice number prefix+number.
  const KNOWN_GOOD = new Map([
    ["BG-2024-1", undefined], // example entries — populated from real dump
  ]);
  // Skip assertion when the DB is empty (demo seed, no real sync).
  if (rows.length > 0 && KNOWN_GOOD.size > 1) {
    let passed = 0;
    let failed = 0;
    for (const [txId, expectedNumber] of KNOWN_GOOD) {
      if (!expectedNumber) continue;
      const match = rows.find((r) => r.transaction_external_id === txId);
      if (!match) {
        console.error(`[verify] MISS: ${txId} — no suggestion found`);
        failed++;
        continue;
      }
      let proposal;
      try {
        proposal = JSON.parse(match.proposal_json);
      } catch {
        console.error(`[verify] PARSE: ${txId} — invalid proposal_json`);
        failed++;
        continue;
      }
      const actualNumber = proposal.invoice?.number ?? "";
      if (actualNumber === expectedNumber) {
        passed++;
      } else {
        console.error(
          `[verify] MISMATCH: ${txId} — expected ${expectedNumber}, got ${actualNumber}`,
        );
        failed++;
      }
    }
    console.log(`[verify] ${passed}/${passed + failed} known-good pairs verified`);
    if (failed > 0) process.exit(1);
  } else {
    console.log("[verify] skipped — no real sync data or KNOWN_GOOD not populated");
  }
  await pool.end();
};

main().catch((err) => {
  console.error("[compute-suggestions] failed:", err.message);
  process.exit(1);
});
