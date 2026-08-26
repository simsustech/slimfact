# 2026-08-18 — Realistic synthetic demo dataset + deterministic test seed

Replaced the faker-based `seed:fake` with a realistic, fully synthetic demo
dataset (modelled on the production dump + live Mollie/open-banking), added a
banking `seed:demo`, a real-data ingestion verification script, and pinned the
E2E test seed's UUIDs for byte-determinism. **Zero real data in the output.**

## Files changed

**New (banking-api):**

- `src/seed/demo/synth.ts` — pure `synthDemoData(guide, seed)` + `mulberry32` +
  `makeIban` (mod-97). Fictional Dutch pools, seeded PRNG, no real data.
- `scripts/generate-demo-data.ts` — offline generator (hardcoded guide, fixed
  seed) that writes the two committed fixtures.
- `src/seed/demoData.ts` — **generated** `demoBanking` fixture (30 settlements,
  61 psp payments, accounts/transactions/balances/connections).
- `src/seed/demo.ts` — `seed:demo` (idempotent upserts; resolves invoice
  number → `checkout.invoices.uuid` as the psp_payment description).
- `scripts/verify-real-data.ts` — runs production ingestion (Mollie + open-
  banking) into a scratch DB (`slimfact_verify`), asserts, drops it.
- `tests/unit/demo-synth.spec.ts`, `tests/unit/demo-seed.spec.ts`.

**New (api):**

- `src/kysely/seeds/demoData.ts` — **generated** `demoCore` fixture (200
  invoices, 124 payments, 2 refunds).
- `tests/unit/banking/demo-fixture-coherence.spec.ts` — cross-fixture
  coherence (imports both committed fixtures).
- `tests/unit/banking/demo-seed.spec.ts` — DB-backed seed integrity +
  `seed:test` determinism.

**Edited:**

- `packages/api/src/kysely/seeds/fake.ts` — fixture-driven rewrite (exports
  `seedFake`); numbered invoices via `openInvoice`, unnumbered BILL/RECEIPT
  stay unnumbered, PSP payments raw-inserted, refunds linked by externalId.
- `packages/api/src/kysely/seeds/test.ts` — pins deterministic UUIDs post-create
  (Option A) for byte-determinism; exports `seedTest`.
- `packages/banking-api/package.json` — `generate:demo`, `seed:demo`,
  `verify:real` scripts + `./demo-data` export.
- `packages/api/package.json` — dropped `seed:fake:generate` from `build`.
- `.gitignore` — `/dump-*.sql`; deleted the real dump file.
- `CONTEXT.md` — "Demo dataset" glossary block.

## Why

- `seed:fake` was faker-random; the new dataset is realistic (dump-derived
  distributions) and content-deterministic (fixed seed).
- `seed:test` and `seed:fake` stay separate datasets; the test seed is now
  byte-deterministic (pinned UUIDs).
- `verify:real` proves the production ingestion path works against real data.

## Findings

- **Pre-existing production bug (out of scope):** `parseAmountToCents`
  (`packages/banking-api/src/banking/money.ts`) rejects 4-decimal amounts, and
  real Mollie cost amounts are e.g. `"8.9700"`. `verify:real` therefore fails
  at `mollieFeeCents` with `Invalid amount: "8.9700"` — the production Mollie
  PSP sync cannot ingest real settlements. Fixing `money.ts` was not in this
  plan's scope.
- **Pre-existing stale test:** `packages/banking-api/tests/unit/migrations.spec.ts`
  assumes 2 migrations; `migrateDown()` now rolls back migration 003, so its
  "psp_settlements gone" assertion fails. Unrelated to this change.
