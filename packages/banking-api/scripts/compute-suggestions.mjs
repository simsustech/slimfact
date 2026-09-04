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

  if (rows.length > 0) {
    // Static-SQL unnest insert (values via bind params only — no interpolation
    // in the query text, so it is injection-safe and passes the raw-SQL lint).
    await pool.query(
      `INSERT INTO open_banking.suggestions
        (transaction_external_id, account_external_id, company_id, proposal_json,
         proposal_company_id, suggestion_count, computed_at)
       SELECT * FROM unnest(
         $1::text[], $2::text[], $3::int[], $4::jsonb[], $5::int[],
         $6::int[], $7::timestamptz[]
       )
       ON CONFLICT (transaction_external_id) DO UPDATE SET
         proposal_json = EXCLUDED.proposal_json,
         proposal_company_id = EXCLUDED.proposal_company_id,
         suggestion_count = EXCLUDED.suggestion_count,
         computed_at = EXCLUDED.computed_at`,
      [
        rows.map((r) => r.transaction_external_id),
        rows.map((r) => r.account_external_id),
        rows.map((r) => r.company_id),
        rows.map((r) => r.proposal_json),
        rows.map((r) => r.proposal_company_id),
        rows.map((r) => r.suggestion_count),
        rows.map((r) => r.computed_at),
      ],
    );
  }

  console.log(
    `[compute-suggestions] ${rows.length} suggestions persisted (${credits.length} credits considered, ${invoices.length} invoices)`,
  );
  await pool.end();
};

main().catch((err) => {
  console.error("[compute-suggestions] failed:", err.message);
  process.exit(1);
});
