# Open-banking branch — consolidated recap

Consolidates the fourteen per-session recaps (2026-08-11 → 2026-08-26) plus the
2026-09-10 cleanup session into one document. Organised by subsystem rather than
by date, and updated to the **final** state of the branch — several details in
the original files are now superseded (see [Superseded](#superseded)).

Branch: `open-banking` (worktree `/home/stefan/Projects/slimfact/.worktrees/open-banking`).

## What the branch delivers

Bank transaction import: real bank accounts are read through
[open-banking.io](https://open-banking.io), incoming credits are matched against
open invoices, and a match is recorded as a normal `checkout.payments` row.

Three layers:

1. **`packages/banking-api`** — standalone proxy. Owns the open-banking.io
   credentials and the sync queue, keeps complete history in its own
   `open_banking` schema, exposes a key-authenticated machine tRPC API.
2. **`packages/api`** — consumes the proxy over tRPC + a WebSocket event bus.
   Keeps **no local bank tables**.
3. **`packages/app`** — admin UI under Payments, plus bank settings.

`packages/tools/src/banking/` holds all framework-free banking logic (matching,
suggestions, reference normalisation, money parsing) — per ADR-0006.

```
┌──────────────┐   tRPC (Bearer key)   ┌──────────────┐   open-banking.io
│ @slimfact/api │ ────────────────────► │ banking-api  │ ◄──── SDK ─────────
└──────────────┘                        └──────────────┘      (credentials)
        ▲                                      │
        └────── bank.sync.* events (WS) ───────┘
```

The proxy and the api communicate **only** over tRPC and the event bus. A shared
Postgres is a deployment convenience, not a requirement — the api never queries
`open_banking` directly.

## Matching: two distinct models

Never mixed. This distinction underpins the whole design.

|               | model A — bank credit                     | model B — PSP payout               |
| ------------- | ----------------------------------------- | ---------------------------------- |
| flow          | bank transaction → invoice(s)             | PSP payout → invoices inside it    |
| when          | **write time** (sync worker auto-applies) | **read time** (`listTransactions`) |
| function      | `buildLinkProposal`                       | `matchSettlementForCredit`         |
| auto-applied? | yes, strict single/multi only             | **never**                          |

### Model A — write-time auto-apply

`processBankSync` (`packages/api/src/banking/sync.ts`) runs on the `processBankSync`
pg-boss queue; cron `BANKING_SYNC_CRON`, default `*/15 7-23 * * *`. Also triggered
by the **Sync now** button (`requestSync` → proxy sync → enqueue ingest with a
`runId`, waits for `bank.sync.finished`).

The ingest **reads only** — it never triggers a proxy sync. The proxy pulls real
bank data on its own cron, `OPENBANKING_SYNC_CRON`, default `0 */4 7-23 * * *`.

Per credit, in order:

1. **Adoption** — `findAdoptablePayment` couples an existing _manual_ bank-transfer
   payment of the exact amount instead of creating a second payment.
2. **Strict proposal** — `single` (exactly one `strict` invoice) or `multi`
   (exact subset sum, max 4 invoices, refuses on a score tie).
3. Otherwise the credit falls to the **Suggestions queue**
   (`listSuggestions` → `suggestForCredit` in `packages/tools/src/banking/suggest.ts`).

`split` is never auto-applied — partial coverage needs a human.

**Strict** requires all of: exact `amountCents`, invoice number present in
description/remittance/referenceNumber, ±14 days booking vs due date, same
currency. Dropping currency gives `medium` (suggested, not applied).

### Model B — read-time PSP recognition

PSPs batch payouts; one net credit covers many invoices. `matchSettlementForCredit`
(`packages/tools/src/banking/match.ts`) recognises such a credit against
`open_banking.psp_settlements`:

- credit + bookingDate required; skip `failed` settlements; same currency;
  ±14 days
- **exact amount tier** — closest payout date wins (tie-break `externalId`)
- **hint tier** — only with a PSP fingerprint (`/mollie|stripe/i` in counterparty
  /IBAN/description) _and_ exactly one candidate in the window

Only applied to credits with **no** existing bank-ref links, so an already-linked
credit can never steal a settlement. One-to-one consumption per pass (splice).

## Final state

### Database

| schema           | owner       | contents                                                                                                            |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `open_banking`   | banking-api | accounts, balances, transactions, connections, sync_runs, api_keys, api_key_accounts, psp_settlements, psp_payments |
| `pgboss_banking` | banking-api | sync queue (`syncBankTransactions`, `syncPspSettlements`)                                                           |
| `public`         | api         | migrations 00, 02–12; `bank_account_companies`, `bank_suggestion_dismissals`                                        |

A linked credit is a `checkout.payments` row with
`transaction_reference = 'bank:<txid>'`, guarded by the partial unique index
`payments_bank_ref_invoice_unique` on `(transaction_reference, invoice_id)` —
created by `createPaymentsTable` (migration 02), so existing instances need it
applied by hand.

### Routes (app)

| route                     | what                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| `/admin/payments`         | payments ledger + **Suggestions** tab (review queue). Link/Dismiss per row. |
| `/admin/settings/banking` | connections, per-account company links, Sync now                            |
| `/admin/bank`             | redirect → `/admin/payments` (legacy links)                                 |

Company ↔ account mapping is **link-first, IBAN fallback**: explicit
`bank_account_companies` rows (many-to-many) win; otherwise the account IBAN is
matched against `companies.iban`.

### Configuration

`bootstrap-config` (`packages/banking-api/scripts/`) generates a complete config:
reads the accounts now in the DB, generates a key (`obk_test_…` / `obk_live_…`),
grants it every one of them, writes mode 0600. Refuses before any account exists
(empty `accounts` = **no** access, not all) and refuses to overwrite without
`--force`.

API keys are `obk_<env>_<43 base64url chars>`; only the SHA-256 hash reaches the
DB. Per key: `scopes` (`read`/`sync`), `accounts` (empty = none), optional
`expiresAt`.

### Deployment

`ghcr.io/simsustech/slimfact-banking-api` — its own package, published by both
the production and staging release workflows. The image **migrates and serves
only**; it does not seed. Deployment docs live in
`packages/banking-api/README.md` (Docker-first; includes a compose example with
Docker secrets).

## Key decisions

- **Proxy owns the sync.** The api has no SDK, no credentials, no local bank
  tables — it ingests passively. (ADR-0002)
- **No local bank working set.** Dropped mid-branch; history lives in the proxy.
- **A linked credit is a payments row.** The payments ledger is the single source
  of truth for "was this paid", not a separate bank table. (ADR-0004)
- **PSP payouts are never auto-applied** — recognised read-time only.
- **Many-to-many account↔company links** (composite PK), not one-to-many, so a
  shared operating account can serve several companies.
- **Deterministic E2E**: specs never delete/truncate/insert/UPDATE the DB. The
  seed _is_ the test world; fresh data = `down --volumes` + reseed.
- **`_FILE` env vars** work for every setting (`@vitrify/tools/env` reads
  `<VAR>_FILE` and anything under `/run/secrets`).

## Verification state

- **Units**: api 129+ passed, banking-api 73 passed (dedicated `slimfact_unit` DB,
  port 5433).
- **E2E**: banking trio (`banking-link`, `banking-proxy`, `banking-review`) plus
  `payments-overview`; full suite last green at 40 passed / 0 failed / 8 skipped.
- **Known flaky** (timeout-class, not deterministic): `payments-overview.spec.ts:73`,
  `administrator.spec.ts:84`, `payments-overview:140`.
- **Pre-existing failures**, not from this branch:
  - `banking-api` `migrations.spec.ts` — asserts `migrateDown()` rolls back `003`,
    but `004_drop_suggestions` is last. Its own comment predates 004.
  - `TS6059` `rootDir` errors in `pnpm --filter @slimfact/app run generate:types`.
  - lint warnings in `packages/api/src/banking/ledger.ts` (unused `Kysely`/`DB`).

## Known limitations

- **No transaction overview.** `admin.listTransactions` (which drives PSP
  settlement recognition) has exactly one caller —
  `useAdminListBankTransactionsQuery` — and **nothing imports it**, so the
  endpoint is unreachable from the UI and the recognition result is never
  surfaced. Settlements _are_ ingested and matched. A transaction overview is
  planned; this is noted in the package README and both admin guides.
- **Double-payment corner case**: if a strict match auto-applies first and a
  manual bank transfer is recorded later for the same invoice, two paid payments
  can exist.
- **`PspSettlement.syncedAt` is typed `Date | null` but the wire sends
  `string | null`.** Nothing reads it, so it is inert — but wrong. Fixing it
  needs a runtime mapper (like the file's `mapAccount`/`mapTransaction`).
- **Production bug found, still present**: `parseAmountToCents`
  (`packages/banking-api/src/banking/money.ts`) rejects 4-decimal amounts, and
  real Mollie fee amounts look like `"8.9700"` — so the production Mollie PSP
  sync cannot ingest real settlements.
- **PSP sync proxy support unverified**: the SDK uses undici's global `fetch`,
  which ignores `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1` (Node 24+).

## Follow-ups left deliberately

- Upstream `@simsustech/quasar-components`: `FilteredModelSelect`'s generic is
  `T extends { id: number; … }`; the data has optional `id`, so three select
  wrappers need double assertions. Relaxing it to `id?: number` removes them.
- Dead `linked-modular-api-*` build contexts in the workflows (inert; the `sed`
  block in the Dockerfile is already dead).
- `_FILE` support for `POSTGRES_PASSWORD` in `packages/banking-api/src/config/postgres.ts`.
- Unused exports in `tools/src/banking/match.ts`: `matchCreditToInvoices` and
  `suggestInvoiceCandidates` (test-only), `resolvePspPaymentIds` (no references).

## Superseded

Details in the original per-session files that no longer hold:

| original claim                                                                      | now                                                                                                                        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Bank UI is three pages (Overview / Review / Settings)                               | `/admin/payments` + `/admin/settings/banking`; `/admin/bank` redirects                                                     |
| `bank_accounts` local working set, `assignAccount`                                  | gone — no local bank tables                                                                                                |
| migration `11_create_bank_tables`, `12_…`, `14_relax_bank_ref_index`, `15_create_…` | renumbered; now `00, 02–12` (`13→11_create_bank_account_companies`, `15→12_create_bank_suggestion_dismissals`); 14 deleted |
| pg-boss schema `pgboss_banking_v11`                                                 | `pgboss_banking` (the `v11` only distinguished it from the api's `pgboss_v11`)                                             |
| `LinkProposal` supported a `psp` mode                                               | removed — PSP is read-time recognition only                                                                                |
| ADRs at `.pi/adr/` (tracked)                                                        | untracked + gitignored (files remain locally)                                                                              |
| `.pi/changes/<date>-*.md` recaps                                                    | this file                                                                                                                  |
| E2E used DB writes in `beforeAll`                                                   | zero DB writes; the seed is the world                                                                                      |

Also removed during the branch: `CONTEXT.md`, the dump-verification workflow
(`verify:real`, `docker-compose.dump.yaml`, dump scripts), `check-schema`
(queried `public` while the tables live in `open_banking` — it failed on a
healthy DB), the unwired `patches/vitrify@0.26.14.patch`, and the docs page
`/guide/bank-import` (merged into the package README).
