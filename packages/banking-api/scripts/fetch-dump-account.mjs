#!/usr/bin/env node
// fetch-dump-account.mjs
// =======================
// Fetches the real bank data for the slimfact_dump account (NL30RABO0153402105)
// from open-banking.io, stores it in the banking-api DB (open_banking schema in
// slimfact_dump), and pg_dumps the open_banking schema to a backup file so the
// data can be reused for future bank-inbox matching tests WITHOUT re-hitting the
// live (rate-limited) open-banking.io API.
//
// Usage (from packages/banking-api):
//   node scripts/fetch-dump-account.mjs
//
// Env:
//   OPENBANKING_CREDENTIALS_JSON  base64 credentials bundle (or env/credentials.json at repo root)
//   POSTGRES_HOST/PORT/USER/PASSWORD/DB  default: localhost:5433 / postgres / ufgouifdgjdfg / slimfact_dump
//   DUMP_ACCOUNT_IBAN             default NL30RABO0153402105
//   BACKUP_FILE                   pg_dump output (default ./.backup/open-banking-dump.sql)
//
// On a 429 rate limit it reads Retry-After and exits 2, so you can re-run it
// after the backoff. Re-runs are idempotent (account/balance/transaction upserts).

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { OpenBankingClient } from "@open-banking-io/client";

const ROOT = process.cwd();
const CREDENTIALS_JSON =
  process.env.OPENBANKING_CREDENTIALS_JSON ||
  (fs.existsSync(path.join(ROOT, "..", "..", "env", "credentials.json"))
    ? Buffer.from(
        fs.readFileSync(path.join(ROOT, "..", "..", "env", "credentials.json"), "utf8"),
      ).toString("base64")
    : undefined);

if (!CREDENTIALS_JSON) {
  console.error(
    "[fetch-dump-account] OPENBANKING_CREDENTIALS_JSON not set and env/credentials.json not found",
  );
  process.exit(1);
}

const IBAN = process.env.DUMP_ACCOUNT_IBAN ?? "NL30RABO0153402105";
const BACKUP_FILE = process.env.BACKUP_FILE ?? path.join(ROOT, ".backup", "open-banking-dump.sql");

const pgcfg = {
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? "5433"),
  user: process.env.POSTGRES_USER ?? "postgres",
  password: process.env.POSTGRES_PASSWORD ?? "ufgouifdgjdfg",
  database: process.env.POSTGRES_DB ?? "slimfact_dump",
};

const amountToCents = (amount) => {
  // SDK amounts are decimal strings like "12.34"; may be a number too.
  const s = String(amount);
  const parts = s.split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] ?? "").padEnd(2, "0").slice(0, 2);
  return Math.round(Number(`${whole}.${frac}`) * 100);
};

const main = async () => {
  let client;
  try {
    const decoded = Buffer.from(CREDENTIALS_JSON, "base64").toString("utf8");
    client = OpenBankingClient.fromBundle(JSON.parse(decoded));
  } catch (e) {
    console.error("[fetch-dump-account] invalid OPENBANKING_CREDENTIALS_JSON:", e?.message ?? e);
    process.exit(1);
  }

  const pool = new pg.Pool(pgcfg);

  try {
    // 1. Find the target account.
    const accounts = await client.getAccounts();
    const target = accounts.find(
      (a) => a.iban && a.iban.replace(/\s/g, "").toUpperCase().includes(IBAN),
    );
    if (!target) {
      console.error(
        `[fetch-dump-account] account ${IBAN} not found among ${accounts.length} accounts`,
      );
      process.exit(1);
    }
    console.log(
      `[fetch-dump-account] found account ${target.id} ${target.aspspName} ${target.iban}`,
    );

    // 2. Upsert the account.
    const account = await pool.query(
      `INSERT INTO open_banking.accounts
         (external_id, aspsp_name, aspsp_country, currency, account_type, bic, iban, bban,
          owner_name, account_name, product, display_name, needs_reconnect, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
       ON CONFLICT (external_id) DO UPDATE SET
         aspsp_name=EXCLUDED.aspsp_name, iban=EXCLUDED.iban, synced_at=now()
       RETURNING id`,
      [
        target.id,
        target.aspspName ?? "",
        target.aspspCountry ?? "",
        target.currency ?? "EUR",
        target.accountType ?? null,
        target.bic ?? null,
        target.iban ?? null,
        target.bban ?? null,
        target.ownerName ?? null,
        target.accountName ?? null,
        target.product ?? null,
        target.displayName ?? null,
        false,
      ],
    );
    const accountId = account.rows[0].id;

    // 3. Upsert balances.
    for (const b of target.balances ?? []) {
      await pool.query(
        `INSERT INTO open_banking.balances (account_id, type, name, amount_cents, currency, reference_date)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (account_id, type) DO UPDATE SET
           amount_cents=EXCLUDED.amount_cents, reference_date=EXCLUDED.reference_date`,
        [
          accountId,
          b.type ?? "interimAvailable",
          b.name ?? null,
          amountToCents(b.amount),
          b.currency ?? "EUR",
          b.referenceDate ?? null,
        ],
      );
    }

    // 4. Fetch transactions (paginated), respecting rate limits.
    let offset = 0;
    const limit = 500;
    let inserted = 0;
    for (;;) {
      const page = await client.getTransactions(target.id, { limit, offset });
      if (page.items.length === 0) break;
      for (const tx of page.items) {
        const res = await pool.query(
          `INSERT INTO open_banking.transactions
             (account_id, external_id, currency, credit_debit, status, booking_date, value_date,
              transaction_date, bank_transaction_code, amount_cents, creditor_name, creditor_iban,
              creditor_bban, creditor_agent_bic, debtor_name, debtor_iban, debtor_bban,
              debtor_agent_bic, remittance_information, note, reference_number, exchange_rate,
              merchant_category_code, balance_after_transaction_cents, balance_after_currency)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
           ON CONFLICT (account_id, external_id) DO NOTHING`,
          [
            accountId,
            tx.id,
            tx.currency,
            tx.creditDebitIndicator,
            tx.status,
            tx.bookingDate,
            tx.valueDate,
            tx.transactionDate,
            tx.bankTransactionCode,
            amountToCents(tx.amount),
            tx.creditorName,
            tx.creditorIban,
            tx.creditorBban,
            tx.creditorAgentBic,
            tx.debtorName,
            tx.debtorIban,
            tx.debtorBban,
            tx.debtorAgentBic,
            tx.remittanceInformation,
            tx.note,
            tx.referenceNumber,
            tx.exchangeRate ?? null,
            tx.merchantCategoryCode ?? null,
            tx.balanceAfterTransaction ? amountToCents(tx.balanceAfterTransaction) : null,
            tx.balanceAfterCurrency ?? null,
          ],
        );
        inserted += res.rowCount;
      }
      offset += page.items.length;
      if (offset >= (page.total ?? 0)) break;
      if (page.items.length < limit) break;
      console.log(`[fetch-dump-account] fetched ${offset} transactions…`);
    }
    console.log(
      `[fetch-dump-account] stored ${inserted} new transactions (account id ${accountId})`,
    );

    // 5. pg_dump the open_banking schema to a backup file.
    fs.mkdirSync(path.dirname(BACKUP_FILE), { recursive: true });
    execFileSync(
      "pg_dump",
      [
        "-h",
        pgcfg.host,
        "-p",
        String(pgcfg.port),
        "-U",
        pgcfg.user,
        "-d",
        pgcfg.database,
        "--schema=open_banking",
        "--no-owner",
        "--no-privileges",
        "-f",
        BACKUP_FILE,
      ],
      { env: { ...process.env, PGPASSWORD: pgcfg.password } },
    );
    console.log(`[fetch-dump-account] backup written to ${BACKUP_FILE}`);
  } catch (err) {
    // Surface Retry-After from a 429 rate-limit response so it can be re-run later.
    const retryAfter = err?.headers?.get?.("retry-after") ?? err?.headers?.retryAfter;
    if (err?.status === 429 || /429/.test(String(err?.message ?? ""))) {
      console.error(
        `[fetch-dump-account] rate-limited; Retry-After=${retryAfter ?? "unknown"}s — re-run after the backoff.`,
      );
      process.exit(2);
    }
    console.error("[fetch-dump-account] failed:", err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

main();
