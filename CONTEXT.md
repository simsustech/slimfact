# CONTEXT

Domain glossary for contributors. New concepts introduced by the banking
decoupling (2026-08-12) plus core domain terms.

## Banking

- **API key** — opaque 256-bit token (`obk_…`) authenticating a machine client
  to banking-api; stored only as a SHA-256 hash with a displayable prefix;
  grants a subset of accounts.
- **Grant** — the set of bank accounts an API key may read; enforced
  server-side (SQL) on every procedure.
- **Key config file** — the mounted JSON file (`BANKING_API_CONFIG_PATH`) that
  is the source of truth for API keys and grants; reconciled into the DB at
  boot; edit + restart to rotate or revoke.
- **Event bus** — `@modular-api/fastify-event-bus`: tRPC WebSocket pub/sub with
  typed topics, in-memory, auth-agnostic; used client↔server and
  server↔server.
- **Relay** — the SlimFact backend subscribes to the proxy's bus and
  re-publishes on its own local bus so browsers receive proxy events (the
  proxy is not reachable from the browser).
- **Working set** — REMOVED: SlimFact no longer keeps a local copy of bank
  data (`bank_accounts` / `bank_transactions` are dropped; migration 12).
  Bank transactions are read straight from the banking-api proxy (the proxy
  stores complete history in the shared `open_banking` schema).
- **Bank-linked payment** — a `checkout.payments` row whose
  `transaction_reference` is `bank:<txid>`; the canonical link between a bank
  credit and an invoice (backed by the partial unique index
  `payments_bank_ref_unique`).
- **Adoption** — coupling an existing exact-amount paid manual banktransfer
  payment (reference NULL/empty or the booking date) to a bank credit instead
  of creating a second payment.
- **Unlinked transaction** — a bank credit without a `bank:` payment link;
  shown in the review queue until applied.
- **Sync scope** — per-key permission to trigger an open-banking.io refresh
  (`sync` procedure); default keys are read-only.
- **Ingest guard** — `BANKING_INGEST_DISABLED` env flag that makes the SlimFact
  ingest worker (`processBankSync`) a no-op; set in the E2E test stack so the
  banking specs observe a stable, unlinked seed world.
- **RequiresReauth** — connection status meaning the bank consent expired;
  accounts under it are skipped until reconnected.
- **Account link** — an explicit `bank_account_companies` row binding a bank
  account to a company (many-to-many: one company may own several accounts and
  one account may serve several companies). Resolution is **link-first, IBAN
  fallback** (`banking/accountLinks.ts` `resolveCompanyIds`): explicit links
  win, otherwise the account's IBAN is matched against `companies.iban`.
- **Hub** — REMOVED: `/admin/bank` overview/review was consolidated into
  `/admin/payments` (two-tab surface: Payments + Suggestions).
- **Suggestion** (bank) — an actionable unlinked bank credit with a matched
  candidate invoice (open or adoptable paid), produced by the matching engine
  in `@slimfact/tools/banking`. Each suggestion row includes the top-scoring
  invoice, candidate UUIDs for the link dialog, and adoptable payment IDs.

## Core domain

- **Invoice** — immutable once opened; status flow CONCEPT → OPEN →
  PAID/CANCELLED.
- **Bill / Receipt** — convertible document types: BILL → RECEIPT → INVOICE.
- **Strict match** — a bank credit auto-applied to an open invoice when the
  amount, reference digit-run, and booking/due-date window all agree and the
  currency matches. The result is a bank-linked payment (`bank:<txid>`).

## Demo dataset

- **Synthetic demo data** — a fully fictional, realistic dev/demo dataset that
  replaces the old faker `seed:fake`. Generated offline by
  `packages/banking-api/scripts/generate-demo-data.ts` (hardcoded distributions
  observed from the production dump / live Mollie / open-banking, fixed seed) into
  two committed TypeScript fixtures: `packages/api/src/kysely/seeds/demoData.ts`
  (`demoCore`) and `packages/banking-api/src/seed/demoData.ts` (`demoBanking`).
  No real name, IBAN, UUID, or `tr_`/`stl_` id ever appears.
- **Numbered vs unnumbered invoices** — the dataset mirrors the dump: only
  OPEN/PAID/CANCELED invoices carry a number (prefix `2026-`, assigned via
  `openInvoice`); BILL/RECEIPT documents stay unnumbered.
- **Invoice-number ↔ UUID linkage** — the api seeds `checkout.invoices` first;
  the banking-api `seed:demo` resolves each `psp_payment`'s invoice number to
  the `checkout.invoices.uuid` at seed time (raw SQL, retry for boot order) and
  writes it as the PSP payment description.
- **Settlement math** — `settlement.netCents = Σ payment.gross − Σ refund.amount
− fee`; the matching "Mollie B.V." bank credit equals `netCents`.
- **`verify:real`** — `packages/banking-api/scripts/verify-real-data.ts` runs the
  production ingestion code (Mollie + open-banking) against real creds into a
  scratch DB (`slimfact_verify`) that is dropped afterwards.
