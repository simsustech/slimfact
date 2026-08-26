# ADR-0004: Payments as the bank ledger (no local bank tables)

- **Status:** accepted (2026-08-13); amended 2026-08-14 (explicit
  many-to-many account links replace pure IBAN resolution)
- **Scope:** `packages/api`, `packages/banking-api` (worktree `open-banking`)
- **Supersedes:** ADR-0003

## Context

ADR-0003 kept a local `bank_accounts` / `bank_transactions` working set so the
review queue and E2E seeding could read bank data without the proxy. That
duplicated every transaction into SlimFact's own schema, needed a separate
`banking` database for the proxy, and made "matched" state a local concern
that could drift from the proxy.

## Decision

Bank transactions live **only** in the banking-api proxy, in the shared
`slimfact` database under the `open_banking` schema (a naming convention — the
same database role, one postgres user). The proxy retains **complete history**
(incremental sync via `accounts.synced_at`; never deletes).

- SlimFact reads bank data **only through the proxy tRPC API** (`getAccounts`,
  `getTransactions`). There are no local bank tables: migration 12 drops
  `bank_transactions` / `bank_accounts`.
- Company → account mapping is **link-first, IBAN fallback**: explicit
  `bank_account_companies` rows (many-to-many — one company may own several
  accounts and one account may serve several companies, e.g. shared operating
  accounts) win; otherwise the account's IBAN is matched against
  `companies.iban` (normalized). The resolution seam is `banking/accountLinks.ts`
  (`fetchAccountCompanyLinks` / `resolveCompanyIds` / `setAccountCompanies`),
  crossed by the router and the ingest worker alike; the settings page manages
  the links (per-account multi-select).
- A linked credit is a **`checkout.payments` row** with
  `transaction_reference = 'bank:<txid>'`, made idempotent by the partial
  unique index `payments_bank_ref_unique` (created in migration 12). A
  concurrent sync/apply can never create a second payment for one credit.
- **Adoption**: an exact-amount paid manual banktransfer payment (reference
  NULL/empty or the booking date, same company + currency) is _coupled_ by
  setting its `transaction_reference`, instead of creating a duplicate
  payment. Both the ingest worker and the review-queue Apply cross the same
  seam (`banking/apply.ts` `linkBankCreditToInvoice`).
- The proxy's own migration history lives in `open_banking.kysely_migration`
  (`migrationTableSchema`); the SlimFact api pins its migration table to
  `public` explicitly so the shared DB cannot confuse the two Migrators.

## Consequences

- Single source of truth: the proxy stores everything; SlimFact holds only
  the outcome (payments). No local replay/resync state to maintain.
- The review queue (`/admin/bank/review`) is fed straight from the proxy;
  applying a credit creates or adopts the bank-linked payment.
- The `banking` database is gone; the proxy uses `slimfact` and only touches
  its own schema (fail-closed API-key grants unchanged).
- Manual-after-auto duplicates are a known limitation: if a strict match
  auto-applies and an admin later records a manual banktransfer payment for
  the same invoice, two PAID payments can exist (documented in the admin
  guide; out of scope).
