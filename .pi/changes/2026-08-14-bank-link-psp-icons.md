# 2026-08-14 — bank link + PSP payout icons plan recap

Implemented `.pi/plans/2026-08-14-bank-link-psp-icons.md` (14 steps, two
workstreams) — evaluation in `.pi/plans/2026-08-14-bank-link-psp-icons.evaluation.md`.
Tree left uncommitted per the user's pre-run decision.

## Workstream 1 — i-mdi icon audit

- `ExportsPage.vue` + `SubscriptionForm.vue` DateInput icons → `i-mdi-calendar`
  / `i-mdi-close`; `InvoicePage.vue` money icon → `i-mdi-bank-transfer`.
- Seeded Acme IBAN fixed to checksum-valid `NL68KNAB0123456789` (EPC QR renders
  on the customer page).

## Workstream 2 — unified bank linking + PSP payout reconciliation

**banking-api** (`packages/banking-api`):

- Migration `002_create_psp_tables.ts`: `open_banking.psp_settlements` +
  `open_banking.psp_payments`.
- `pspSync.ts` (`runPspSync` on an injectable `PspAdapter`), `pspAdapters.ts`
  (Mollie/Stripe SDK — new deps `@mollie/api-client`, `stripe`), `pgboss.ts`
  PSP_SYNC_QUEUE; tRPC `listPspSettlements`/`listPspPayments`.
- Seed: `seed-credit-006` (Mollie 42.00), `seed-credit-007` (80.00 = D+F),
  `psp_settlements`/`psp_payments` fixtures.

**api** (`packages/api`):

- Migration `14_relax_bank_ref_index.ts`: partial unique
  `payments_bank_ref_invoice_unique` on `(transaction_reference, invoice_id)`.
- `match.ts`: generic `LinkProposal`; `buildLinkProposal`
  psp→single→multi/subset-sum→adoption→split (split display-only overpay);
  `resolvePspSettlement`/`resolvePspPaymentIds`.
- `apply.ts`: `linkBankCreditsToInvoices`, `reconcilePspPayout`, multi-row
  `fetchBankPayments`; `sync.ts` worker adoption-first, PSP never auto-applied.
- tRPC: `listTransactions` (coverage unlinked|partial|full|reconciled,
  linkedInvoices, suggestion), `applyLink` (direct/psp); `listReview`/
  `applyMatch` deleted.
- Seed: demo invoice F (2026-0006, €40) + Mollie-paid row on E
  (`settlementId setl-seed-001`).

**app** (`packages/app`):

- `BankOverviewPage.vue` merged (coverage chips, `→` hints, Link button);
  `BankReviewPage.vue` deleted; route `/admin/bank/review` redirects to
  overview; drawer review item removed; new `BankLinkDialog.vue`.
- Queries (Coverage/LinkProposal/applyLink) + en/nl/de lang keys.

## Test changes

- New `banking-link.spec.ts` (overview/redirect/drawer + single/adopt/split/
  multi/psp); `banking-review.spec.ts` trimmed to settings; company-filter
  (6→8 rows, chips, 2 drawer entries); proxy index name; self-contained
  `icons.spec.ts`.
- Pre-existing fragile selectors fixed in invoice-flow/administrator specs:
  role-less `.q-item` Lines-Add (×6), BILL method sub-menu cash flow, ambiguous
  `/cancel/i` → dialog-scoped OK. Unit spec cleanup upgraded to
  `TRUNCATE … CASCADE` (shared-Postgres `initial_number_for_prefixes` FK).

## Gates (all green)

- Full E2E: 27 passed / 8 skipped (env-gated PSP + connection) / 0 failed.
- Units: api 113, banking-api 36. Lint 0, format clean,
  `PI_RTK_BYPASS=1 pnpm run build` exit 0.

## Environment notes

- Docker containerd snapshot corruption worked around with a fresh
  `docker buildx create --driver docker-container` builder; external `web`
  network recreated; banking-api needs a restart after `up` (DB-not-ready boot
  race).

## Post-run hardening (2026-08-16)

- **Separate unit-test DB**: unit specs (api + banking-api) wiped the shared
  stack DB when run after the E2E gate (banking-api specs delete
  `open_banking.api_keys` → `Missing or unknown API key` on slimfact.localhost).
  Added `docker/initdb/01-create-unit-db.sql` (creates `slimfact_unit`) mounted
  into the postgres service of both compose files; the banking-api spec defaults
  now target `slimfact_unit`; AGENTS.md documents the migrate + run recipe.
  Verified: units 113+36 green against `slimfact_unit`, stack DB untouched,
  full E2E suite still 27/8/0.
  race).
