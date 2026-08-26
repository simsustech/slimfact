# 2026-08-13 bank transactions as payments (no local bank tables)

Implemented `/home/stefan/Projects/slimfact/.worktrees/open-banking/.pi/plans/2026-08-13-bank-transactions-as-payments.md`
end to end: SlimFact's local bank working set is gone; bank transactions live
in the banking-api proxy (shared `slimfact` DB, `open_banking` schema, complete
history) and are read only through the proxy tRPC API. A linked credit is a
`checkout.payments` row with `transaction_reference = 'bank:<txid>'` (partial
unique index). The bank UI is now three pages: Overview / Review / Settings.

## Proxy (banking-api)

- Migration 001 now creates the `open_banking` schema; all 7 tables + the
  index are schema-qualified (`db.schema.withSchema`). Migrator uses
  `migrationTableSchema: 'open_banking'`; pg-boss schema → `pgboss_banking_v11`.
- `bootstrap.ts` (CREATE DATABASE) removed; Dockerfile CMD drops it.
- `kysely/index.ts` root `.withSchema("open_banking")` — the single point that
  resolves every proxy query into its schema on the shared DB (user-approved).
- Sync is incremental: first run unbounded, then `from = synced_at − 1d`
  (overlap for late postings); history accumulates, nothing is deleted.
- `docker-compose.test.yaml`: banking-api `POSTGRES_DB` → `slimfact`.

## SlimFact api

- Migration 12 drops `bank_transactions` / `bank_accounts` and creates the
  partial unique index `payments_bank_ref_unique` on `checkout.payments`.
- `api/src/kysely/migrate.ts` pins `migrationTableSchema: 'public'` (the
  shared DB's open_banking migration tables would otherwise fool the
  Migrator's table-exists introspection).
- `banking/match.ts` reworked: `MatchTransaction` drops the working-set
  fields, gains `accountExternalId`; explicit `linked` gate; `canApply` gains
  `alreadyLinked`; new `findAdoptablePayment` (+ empty-string ref — the POS
  flow stores `''`) and proactive adoption chips (`adopt: true`).
- New `banking/apply.ts` — the create-or-adopt seam both the worker and the
  review Apply cross: `fetchBankPayments` (one indexed batch query),
  `linkBankCreditToInvoice` (adopt → UPDATE ref; else
  `addPaymentToInvoice` with `transactionReference: 'bank:<txid>'`;
  unique-violation → alreadyLinked).
- `banking/sync.ts` worker rework: IBAN-derived company map, 90-day window
  paged fetch, `fetchBankPayments` dedupe, per credit linked → adoption →
  strict-match → `linkBankCreditToInvoice`. `SyncResult` =
  `{ accounts, fetched, applied, adopted, skippedRequiresReauth }`. Dead
  helpers removed.
- tRPC router rewrite: `listTransactions` (overview, filters + linked flag +
  invoice number), `listReview` (suggestions + adopt chips + openInvoices),
  `applyMatch` (adoption-first, `canApply` guards); `getAvailableAccounts`
  returns IBAN-derived company name; dropped `listUnmatched`, ignore/unignore,
  setAccountActive, removeAccount, getStats.
- `pgboss.ts` log line → `accounts, fetched, applied, adopted, skipped`.

## App

- Routes: `/admin/bank` (Overview + FAB), `/admin/bank/review`, `/admin/bank/settings`.
- MainLayout Bank expansion group (3 entries); dashboard menu stays → `/admin/bank`.
- `BankOverviewPage`, `BankReviewPage`, `BankSettingsPage` replace the tabbed
  BankPage; `queries/admin/bankTransactions.ts` rewritten for the new tRPC
  surface; lang keys (en/nl/de) updated.
- `src/shims-vue.d.ts` added (the app lacked the standard `*.vue` shim).

## E2E

- `helpers.ts`: `mkBankFixture`/`clearBankFixtures` write `open_banking`
  rows directly (e2e- prefixed ids).
- `banking-proxy.spec.ts`: sync-now flow via `/admin/bank/settings`; asserts
  the invoice flips PAID and `transaction_reference = 'bank:seed-credit-001'`;
  migration-12 contract assertions in beforeAll.
- `banking-company-filter.spec.ts`: IBAN-derived companies, linked flag +
  boolean filter, drawer nav (3 entries).
- `banking-review.spec.ts` (replaces `bank-transactions.spec.ts`): review +
  apply, adoption (manual banktransfer payment coupled, no duplicate),
  overpay blocked, not-configured notice (skips on the configured stack).
- Bank specs require serial execution (shared DB) — run with `--workers=1`.
  The review spec parks the Knab connection in RequiresReauth so the */15
  worker cron cannot race the manual review flow; the proxy spec restores it.
- Pre-existing (not caused by this plan): `invoice-flow` and `administrator`
  specs time out on their role-based lines-list locator; PSP specs need API
  keys; screenshots specs need `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Verified

- Proxy unit suite 32/32; api unit suite 91/91 (with TEST_DATABASE_URL).
- Bank E2E specs green (5 passed, 1 skipped-by-design); account /
  invoice-line-types / cash-payments green.
- `pnpm run lint`, `format:check`, and `PI_RTK_BYPASS=1 pnpm run build` clean.

## Docs

- ADRs moved `docs/adr/` → `.pi/adr/`; new
  `.pi/adr/0004-payments-as-bank-ledger.md` (supersedes 0003).
- `CONTEXT.md` glossary: Working set removed; bank-linked payment / adoption /
  unlinked transaction added.
- `AGENTS.md` open-banking section rewritten (no local tables, 3 pages).
- Admin guides (en/nl) bank-import section updated.
