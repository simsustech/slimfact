# Bank transactions → payments: exact data flow

> Status: **draft for review** · 2026-08-14 · every claim verified against the
> current tree (`packages/banking-api`, `packages/api/src/banking/*`,
> `packages/app/src/pages/admin/BankPage/*`) and the E2E trio
> (2 consecutive green fresh-stack runs).

## 1. Actors

| Actor            | Package                                          | Role                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Proxy**        | `packages/banking-api` (`@slimfact/banking-api`) | Owns the open-banking.io credentials and its own pg-boss sync queue. Exposes a machine tRPC API (`/trpc`, per-key API-key grants from `config.test.json`), and publishes `bank.sync.*` progress on the shared event bus. |
| **SlimFact api** | `packages/api`                                   | Reads bank data only through the proxy; records outcomes as `checkout.payments` rows; runs the ingest worker (`processBankSync` on pg-boss).                                                                             |
| **App**          | `packages/app`                                   | Admin UI: `/admin/bank/overview`, `/admin/bank/review`, `/admin/bank/settings`, hub.                                                                                                                                     |
| **Checkout**     | `@modular-api/fastify-checkout`                  | `invoiceHandler.addPaymentToInvoice` — creates payments and drives the invoice PAID transition.                                                                                                                          |

**Ground rule**: SlimFact keeps **no local bank tables** (migration 12 dropped
`bank_accounts`/`bank_transactions`). All bank data lives in the proxy's
`open_banking` schema; SlimFact never deletes bank data — it only records the
outcome (a payment row with `transaction_reference = 'bank:<txid>'`).

## 2. The flow, stage by stage

### Stage 1 — Ingestion (proxy, `open_banking` schema)

The proxy syncs accounts + transactions from open-banking.io (SDK). In the
test stack there are no credentials, so the **seed** (`packages/banking-api/src/seed/test.ts`)
writes the history directly: 2 connections (conn-knab `RequiresReauth`,
conn-rabobank `Active`), 2 accounts (knab-acc, rabobank-acc), 6 transactions:

| external_id     | account  | cents | note                | direction |
| --------------- | -------- | ----- | ------------------- | --------- |
| seed-credit-001 | knab     | 4200  | —                   | CRDT      |
| seed-credit-002 | knab     | 5000  | `FACTUUR 2026-0001` | CRDT      |
| seed-credit-003 | knab     | 3000  | `FACTUUR 2026-0002` | CRDT      |
| seed-credit-004 | rabobank | 2500  | `FACTUUR 2026-0003` | CRDT      |
| seed-credit-005 | knab     | 7500  | `FACTUUR 2026-0004` | CRDT      |
| seed-noise-001  | knab     | −1999 | —                   | DBIT      |

The proxy keeps **complete history** (incremental sync via `accounts.synced_at`,
never deletes). All amounts are **integer cents** everywhere.

### Stage 2 — Sync trigger (UI → proxy → bus → api)

`Sync now` (settings) → api `requestSync`:

1. proxy `syncAll()` (tRPC, API-key auth) → the proxy's pg-boss `SYNC_QUEUE`
   worker runs; in tame mode it records a `sync_runs` row and publishes
   `bank.sync.started` / `bank.sync.finished` on the event bus (the UI shows
   progress via the bus, `BANKING_SYNC_TIMEOUT_MS` fallback).
2. `requestSync` then enqueues the api's **ingest worker**:
   `boss.send('processBankSync', { runId }, { singletonKey: 'process-sync' })`.

> In the test stack the periodic schedule is disabled
> (`BANKING_SYNC_CRON: disabled` — pg-boss skips `boss.schedule` but still
> registers the worker + queue), so the worker runs **only** on demand.

### Stage 3 — Ingest worker (`packages/api/src/banking/sync.ts`)

Per sync, once:

- **Connection filter**: connections that need re-consent (`RequiresReauth` /
  expired / `needsReconnect`) are skipped and logged
  (`result.skippedRequiresReauth`). Parked accounts never auto-apply.
- **Company resolution**: `fetchAccountCompanyLinks(db)` (one batch query of
  `bank_account_companies`) + IBAN map; per account,
  `resolveCompanyIds(links, ibans, account)` = **explicit links first, IBAN
  fallback, `[]` when neither**. The worker matches per linked company.
- **Dedupe index**: `fetchBankPayments(db)` — every `checkout.payments` row
  with `transaction_reference LIKE 'bank:%'` (backed by the partial unique
  index `payments_bank_ref_unique`). One index for the whole sync.

Per account → per credit (CRDT + BOOK only, not already linked):

1. **Adoption first**: `findAdoptablePayment` — a paid manual
   `banktransfer` payment on the same invoice with the exact amount and no
   reference (NULL, `''`, or the booking date) → couple it instead of creating
   a second payment.
2. **Strict match**: `matchCreditToInvoices` (scoreCandidate): exact amount +
   reference contains the invoice number + booking within 14 days + same
   currency → auto-apply; more than one strict candidate → ambiguous (skip).
3. After a successful apply the credit is added to the dedupe set and the
   per-company loop `break`s — a shared account never double-links a credit.

### Stage 4 — The payment record (`packages/api/src/banking/apply.ts`)

`linkBankCreditToInvoice` is the seam both the worker and the router cross:

- **Already linked** (`bank:<txid>` in the index) → `{ alreadyLinked: true }`,
  never a second payment (the partial unique index is the backstop — a
  concurrent apply surfaces as a unique-violation → `alreadyLinked`).
- **Adoptable** (and same company + currency) → `UPDATE checkout.payments SET
transaction_reference = 'bank:<txid>'` on the existing manual payment. **No
  new row.**
- Otherwise → `invoiceHandler.addPaymentToInvoice({ id, payment: { amount:
cents, currency, description, method: banktransfer,
transactionReference: 'bank:<txid>' } })` → new `checkout.payments` row; the
  checkout handler transitions the invoice to **PAID** when fully covered.

### Stage 5 — Review queue (router `listReview`)

Unlinked BOOK credits within the 90-day window, **one queue entry per linked
company** (many-to-many). Each entry carries ranked `suggestions`
(`suggestInvoiceCandidates`, top 3): adoption chips (invoice with an
exact-amount paid manual banktransfer payment, ranked first) + scored
suggestions (strict/medium/low). Chips now render the **invoice number** even
for paid invoices (`Suggestion.invoiceNumber`), and the entry shows the
company name.

### Stage 6 — Manual apply (router `applyMatch`)

Revalidates: account exists (proxy), transaction is a booked credit, currency
supported, invoice belongs to one of the account's linked companies; then the
same create-or-adopt seam. `canApply` guards are **re-run at apply time**
(invoice open, company matches, amount ≤ due, not already linked) so a stale
suggestion can never hit a paid/cancelled invoice.

### Stage 7 — Overview (router `listTransactions`)

All transactions (paged, from/to window) enriched with: resolved
company/companies + name, `linked` flag (a `bank:<txid>` payment exists) and
the linked invoice number (`Linked to 2026-0005` chip). Filters: Status
(all/linked/unlinked), Companies (multi), From/To (`DateInput`).

## 3. The deterministic seed world (E2E, no DB writes in tests)

Per your correction: **E2E specs never delete/truncate/insert/UPDATE the
database.** The seed provides everything the tests assert against; fresh data
comes from `down --volumes` + reseed (the default playwright config's
globalSetup does exactly that).

The api seed (`packages/api/src/kysely/seeds/test.ts` demo block) creates the
counterpart world — all via the **real handler flow**
(`createInvoice → openInvoice → addPaymentToInvoice`):

| Invoice | number    | cents | status                                    | purpose                        |
| ------- | --------- | ----- | ----------------------------------------- | ------------------------------ |
| A       | 2026-0001 | 5000  | open                                      | happy-path apply (002)         |
| B       | 2026-0002 | 3000  | **paid** + manual banktransfer (ref NULL) | adoption (003)                 |
| C       | 2026-0003 | 2500  | open                                      | auto-apply on `Sync now` (004) |
| D       | 2026-0004 | 4000  | open                                      | overpay blocked (005)          |
| E       | 2026-0005 | 4200  | **paid** + `bank:seed-credit-001`         | overview Linked chip           |

Companies: **Acme Inc** (iban `NL00KNAB0123456789`, explicitly linked to both
accounts) and **Rabo BV** (iban `NL00RABO0123456789`, **not** linked — proves
link-first over the IBAN fallback in the E2E). The settings picker round-trip
links Rabo BV via the UI; `bank:seed-credit-001` is the seeded linked baseline.

E2E trio coverage (all UI flows, read-only DB asserts for invoice/payment
state): overview counts + linked chip + status partition, company filter,
link-over-iban round trip, drawer + hub, `Sync now` → C paid with
`bank:seed-credit-004`, review happy path → A paid, adoption → B coupled
(single payment), overpay → rejected.

## 4. Self-review & suggestions

Verified during this pass: the flow above is accurate to the code; the E2E
suite is deterministic (2/2 green fresh-stack runs) and the earlier flake is
gone. What I found and fixed while making it so:

- **Fixed — Status filter broken (real app bug).** `BankOverviewPage.vue`'s
  Status select lacked `emit-value map-options`, so `v-model` stored the option
  **object** and `linkedRef` (string comparison) always evaluated to `false` —
  the Linked filter silently showed _unlinked_ rows. Hidden until now because
  the old spec never asserted a Linked-filter count.
- **Fixed — settings picker spurious mutation.** The picker used `v-model`,
  so populating it on load fired a `setAccountCompanies` write (materializing
  IBAN fallbacks as explicit links) and raced the test navigation. Now
  `:model-value` + emitted-value handler — writes only on user interaction.
- **Fixed — adoption chip label.** Paid invoices' adoption chips rendered
  `#<id>` (they're absent from `openInvoices`); suggestions now carry
  `invoiceNumber`.
- **Fixed — test determinism.** The trio's review/overview assertions used
  ambiguous locators (a €75 credit suggests _every_ open invoice via the
  overpay fallback) and raced refetch transitions; now keyed on unique amounts
  and settled views.

Open suggestions (not blocking):

1. **Adoption fall-through (prior review R2, still open).** In
   `linkBankCreditToInvoice`, when `findAdoptablePayment` matches but the
   company/currency check fails, execution falls through to
   `addPaymentToInvoice` — bypassing `canApply` and potentially creating a
   payment on a **paid** invoice. Return a distinct non-adoptable outcome
   instead; add a unit case.
2. **`applyMatch` MAX_FETCH window (prior R3, still open).** The overview's
   from/to window can surface transactions beyond the 500-item fetch in
   `applyMatch`, which then returns NOT_FOUND. Fetch by the transaction's
   booking window or return a clearer error.
3. **`formatAmount` double minus.** A DBIT credit renders `--19.99 EUR`
   (the `-` prefix plus the negative amount). Cosmetic; the amount is
   `amountCents`-negative and the sign prefix is added unconditionally.
4. **Picker display conflation.** The settings picker shows the _resolved_
   company set (link ∪ IBAN fallback) as if all were explicit links; editing
   persists the full resolved set as explicit links. Could surprise — consider
   distinguishing implicit from explicit in the picker.
5. **`setAccountCompanies` is delete-then-insert** without a transaction —
   a failed insert drops the account's existing links.
6. **Seed hygiene:** `seed:test`'s top-level company insert is not idempotent
   (pre-existing; only safe on a fresh DB), and the proxy seed's
   `console.log` hardcodes `transactions=${6}` regardless of what was
   inserted.
7. **Gate order documented** (E2E before `pnpm test` — the unit DB specs
   `TRUNCATE companies` on the same Postgres).

**For your review**: the flow section (2) and the fixes (4) are the parts to
verify; the open suggestions are mine and optional.
