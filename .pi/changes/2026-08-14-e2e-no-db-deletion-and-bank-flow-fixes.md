# 2026-08-14 — E2E no-DB-deletion rewrite + bank flow fixes

## Why

User correction: E2E tests must never delete/truncate/insert/UPDATE the
database. The seed provides what tests need; fresh data = `down --volumes` +
reseed. The banking specs previously wiped/parked/inserted fixtures in
`beforeAll`/`beforeEach` for determinism — removed entirely.

## What changed

- **Seed becomes the deterministic test world**: `packages/banking-api/src/seed/test.ts`
  adds `seed-credit-005` (€75, knab, `FACTUUR 2026-0004`); the api seed demo
  block adds invoices D (€40, open) + E (€42, paid via
  `bank:seed-credit-001`) and company **Rabo BV** (iban matches rabobank-acc
  but unlinked — link-first proof). Real handler flow
  (`createInvoice → openInvoice → addPaymentToInvoice`) throughout.
- **Test-stack worker cron disabled**: `BANKING_SYNC_CRON: disabled` in
  `docker-compose.test.yaml` (a never-firing cron like `0 0 31 2 *` crashes
  cron-parser). `pgboss.ts` now always creates the queue + registers the
  worker when banking is enabled and only skips `boss.schedule` when the cron
  is `disabled` — `Sync now` still runs the worker on demand.
- **Specs rewritten, zero DB writes** (`banking-proxy`, `banking-company-filter`,
  `banking-review`): assert the seeded world via UI + read-only DB polls.
  Removed `mkBankFixture`, `clearBankFixtures`, `clearBankAccountLinks` from
  `helpers.ts` (also `BankFixtureOptions`).
- **App bugs found & fixed**:
  - Status filter on the overview never worked: `q-select` lacked
    `emit-value map-options`, so `v-model` held the option object and
    `linkedRef` always evaluated `false` (the Linked filter showed unlinked
    rows). This was the root cause of the original review flake.
  - Settings picker fired a spurious `setAccountCompanies` mutation on mount
    (`v-model` population); switched to `:model-value` + emitted-value handler
    — writes only on user interaction.
  - Adoption chips for paid invoices rendered `#<id>`; `Suggestion` now
    carries `invoiceNumber` (`match.ts`, app types, review page labels).
    Also fixed the pre-existing `scoreCandidate` missing `invoiceNumber`
    (ScoredCandidate required it) and the `adoptionChips` type-predicate error.
- **Docs**: AGENTS.md documents the deterministic E2E model + gate order
  (E2E before `pnpm test`); flow summary at
  `.pi/docs/bank-transactions-payments-flow.md`.

## Verification

- E2E trio (proxy, company-filter, review): **8 passed / 1 skipped**, two
  consecutive fresh-stack runs.
- Unit `pnpm test` (TEST_DATABASE_URL): **100/100**.
- `pnpm run build` exit 0; `lint` exit 0; `format:check` clean.
