# 2026-08-14 — Bank links + UI polish

Follow-up to `2026-08-13-bank-transactions-as-payments.md`. Three workstreams:
hub navigation, explicit company ↔ account links (many-to-many), and a
deterministic review-queue / auto-apply seed demo.

## Files changed

**App (`packages/app`)**

- `lang/en-US.ts`, `lang/nl.ts`, `lang/de.ts`, `lang/index.ts` — bank drawer
  label `To match` → `Review`; `companyFilter` value → `Companies` /
  `Bedrijven` / `Unternehmen`; new `bank.connections` key.
- `pages/admin/BankPage/BankOverviewPage.vue` — `q-input type="date"` → custom
  `DateInput` (`@simsustech/quasar-components/form`); From/To refs become
  `string | null`; q-table `:pagination="{ rowsPerPage: 0 }"` so filters count
  all rows (default 5/page truncated the seed demo counts).
- `pages/admin/BankPage/BankPage.vue` (new) — `/admin/bank` hub menu page.
- `components/dashboard/DashboardBankMenuList.vue` (new) — Overview / Review /
  Settings menu list (templates: `SettingsPage.vue` + `DashboardAdminSettingsMenuList.vue`).
- `router/routes.ts` — bank children: `''` hub, `overview` (with fabs), review, settings.
- `layouts/MainLayout.vue` — drawer Bank Overview item → `/admin/bank/overview`.
- `pages/admin/BankPage/BankSettingsPage.vue` — connections as a `q-list` with
  per-item `RequiresReauth` warning (`i-mdi-warning` + `text-amber-8`); per
  account a dense clearable **multi-select** company picker
  (`bank.columns.company`) calling the new `setAccountCompanies` mutation.
- `pages/admin/BankPage/BankReviewPage.vue` — selection/applying state keyed by
  `(transaction.externalId, companyId)` — a shared account's credit can appear
  once per linked company.
- `queries/admin/bankTransactions.ts` — `AvailableAccount.companyIds`;
  `ReviewEntry.companyName`; new `useAdminSetBankAccountCompaniesMutation`.

**API (`packages/api`)**

- `kysely/migrations/13_create_bank_account_companies.ts` (new) — composite PK
  `(account_external_id, company_id)`: many-to-many (one company ↔ many
  accounts, one account ↔ many companies). `kysely/types.ts` gains
  `BankAccountCompanies`.
- `banking/accountLinks.ts` (new) — the shared seam: `fetchAccountCompanyLinks`
  (batch, account → company ids), pure `resolveCompanyIds` (**link-first, IBAN
  fallback**), `setAccountCompanies` (replace-all; empty clears → fallback
  resumes).
- `trpc/admin/bankTransactions.ts` — `getAvailableAccounts`, `listTransactions`,
  `listReview`, `applyMatch` resolve via `resolveCompanyIds`; `listReview`
  emits one entry per linked company (with `companyName`); new mutation
  `setAccountCompanies` (account validated against the proxy, NOT_FOUND).
- `banking/sync.ts` — worker resolves per company (`resolveCompanyIds`), builds
  per-company open-invoice / adoptable-payment sets, and `break`s after a
  successful apply so a shared account never double-links a credit.

**Seeds**

- `packages/banking-api/src/seed/test.ts` — conn-knab parked `RequiresReauth`
  (review-queue demo deterministic; E2E specs toggle it), conn-rabobank
  `Active` (auto-apply showcase); + `seed-credit-002/003` (knab, €50/€30,
  `FACTUUR 2026-0001/2`, booking today−1) and `seed-credit-004` (rabobank,
  €25, `FACTUUR 2026-0003`).
- `packages/api/src/kysely/seeds/test.ts` — Acme iban → `NL00KNAB0123456789`;
  `E2E`/`2026-000` number prefix + initial number; idempotent demo block:
  links Acme ↔ knab-acc/rabobank-acc, invoices A/B/C via the real flow
  (`createInvoice → openInvoice → addPaymentToInvoice`; B paid with a manual
  banktransfer, ref NULL — adoptable).

**Tests**

- `tests/e2e/helpers.ts` — `clearBankAccountLinks()`; `mkInvoice`'s send flow
  waits for the expansion menu + send dialog (removes a CONCEPT-send race).
- `tests/e2e/banking-company-filter.spec.ts` — `getByLabel('Companies')`,
  DateInput presence, drawer hrefs (`/admin/bank/overview`) + hub visit,
  seed-demo counts (7/5/7/2/7/6), new **link-over-iban** test (settings picker
  round-trip: link beats the IBAN fallback), beforeAll clears links + demo
  invoices/payments (deterministic vs the `*/15` cron).
- `tests/e2e/banking-review.spec.ts` — `clearBankAccountLinks()` in beforeAll.
- `tests/e2e/banking-proxy.spec.ts` — `clearBankAccountLinks()`; parks
  conn-rabobank; strengthened settings assertion (Rabobank row shows
  `i-mdi-warning` + `Reauthorization required`).
- `tests/unit/banking/accountLinks.spec.ts` (new) — `resolveCompanyIds` pure
  matrix (link-first, IBAN fallback, M:N, none) + DB-backed
  `setAccountCompanies`/`fetchAccountCompanyLinks` round-trips.
- `tests/unit/banking/sync.spec.ts` — link-first worker case (explicit link
  beats an IBAN that matches another company).

**Docs** — `.pi/adr/0004-payments-as-bank-ledger.md` amendment (link-first
resolution), `CONTEXT.md` glossary (account link, hub), `AGENTS.md` open-banking
section, this recap.

## User steering (mid-run)

- **Many-to-many links**: the plan's account-centric PK (one account, one
  company) was changed to a composite PK per the user's direction — one account
  can now serve several companies (shared operating accounts). Resolution
  functions became set-based (`resolveCompanyIds`, `setAccountCompanies`), the
  settings picker is a multi-select, the review queue lists one entry per
  linked company, and the worker matches per company with a post-apply `break`.
- **Real invoice flow in the seed**: the demo invoices use
  `createInvoice → openInvoice → addPaymentToInvoice` instead of raw status
  UPDATEs, so numbers and the PAID transition follow the production path.

## Deviations from the plan

- The step-7 settings-reauth E2E assertion targets the connection that actually
  requires reauth during the run (Rabobank, re-parked by the spec's beforeAll)
  rather than relying on the seed state, because the seed flip makes Rabobank
  Active (auto-apply showcase) and the proxy spec restores Knab.
- `banking-proxy.spec`'s beforeAll parks conn-rabobank to keep that assertion
  deterministic across runs; the fresh-stack auto-apply demo (004 → C) is
  verified before the specs run.
- `mkInvoice`'s send flow gained waits (fixes an order-dependent CONCEPT-send
  race seen when specs run back-to-back on an accumulated stack).
- Overview q-table shows all rows (`rowsPerPage: 0`) — the seed demo's counts
  exceed the Quasar 5-row default page.

## Verification

- Unit: `pnpm test` 100/100 with `TEST_DATABASE_URL` (includes the new
  accountLinks suite + sync link-first case).
- Trio: `banking-proxy`, `banking-company-filter` (incl. link-over-iban),
  `banking-review` — 6 passed / 1 skipped, stable across repeat runs.
- Seed demo on a fresh stack: 2 links, invoices `2026-0001..0003` (A open, B
  paid + manual banktransfer row, C open), review queue shows the `2026-0001`
  suggestion chip + `already paid by bank` adoption chip, and after `Sync now`
  invoice C is PAID with `transaction_reference = bank:seed-credit-004`.
- E2E runs destroy the demo data (invoices + links wiped); re-seed by
  restarting the stack (`down --volumes`, `up -d --wait`).
