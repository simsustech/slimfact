# 2026-08-13 banking-api-proxy (steps 1–19)

Implemented `/home/stefan/.pi/plans/2026-08-12-banking-api-proxy.md` end to end:
the open-banking.io integration moved out of SlimFact into a new proxy service
(`packages/banking-api`), a reusable tRPC WebSocket event bus was built in
`@modular-api/event-bus`, and the BankPage "Sync now" flow now runs through the
bus. **E2E green** (`banking-proxy.spec.ts`, 1 passed).

## Track 0 — event bus (modular-api repo, branch `event-bus`)

- New `@modular-api/event-bus` package: in-memory `EventBus` with zod-validated
  typed topics + segment globs; `createEventBusServer` (tRPC WS, `authenticate`
  hook, `canSubscribe` gating); `createEventBusClient` (Node ws headers /
  browser `connectionParams`, auto-reconnect). 16/16 tests. Changeset written;
  **publish to npm.simus.tech deferred to the user** (the overlay link is used
  until then).

## Track A — banking-api proxy (worktree `open-banking`)

- Scaffold mirroring `packages/api` (NodeNext tsc build, config/postgres
  helpers); migration 001 (7 tables); API-key core (`obk_<env>_<43ch>`,
  SHA-256 hashes, fail-closed config reconcile); tRPC `apiKeyProcedure` with
  SQL-level grants + scopes; `sync` enqueue (singleton cooldown); sync
  orchestrator (persists all data, `sync_runs`, `bank.sync.*` events, rate
  cap, 429 → rate_limited, reauth-skip); pg-boss queue + cron; event-bus
  registration (API-key handshake auth); seed:test + config.test.json + 3
  scripts. 30/30 tests.

## Track B — SlimFact decoupling

- Proxy tRPC client (splitLink httpBatchLink + wsLink); env
  `BANKING_API_URL/KEY/SYNC_WAIT_MS`; relay hub re-publishes proxy
  `bank.**` events locally; `processBankSync` worker (runId wait → fetch →
  upsert → strict-match auto-apply); tRPC `requestSync`; app `buildTrpcLinks`
  (client-only wsLink), `useBankSyncNow`, BankPage FAB + lang keys; SDK
  removed. Api 65 passed + 6 skipped.

## Track C — integration (this session)

- **Docker stack**: `banking-api` Dockerfile target + compose service
  (staging-only, zero ports, `POSTGRES_DB=banking`); DB bootstrap script
  (creates the banking DB, postgres-startup retry); event-bus overlay
  (BuildKit context + workspace `link:` rewrite). Fixed a Dockerfile ordering
  bug (banking-api stages inserted mid-api-stage swallowed the api COPY/CMD),
  `ws` moved from devDeps→deps, `API_HOST` backslash typo in the compose
  (broke the OIDC issuer), and a leftover medusa container stealing the
  `slimfact.localhost` caddy route.
- **vitrify pnpm patch** (`patches/vitrify@0.26.14.patch`): the rolldown
  shared-chunk split produced a circular chunk pair (vue reactivity ⇄ quasar
  components) that crashed the client ("RefImpl is not a constructor" /
  "isFunction is not a function"). Patch bundles all node_modules into one
  acyclic vendor chunk while keeping the SSR entry groups.
- **E2E** `tests/e2e/banking-proxy.spec.ts`: mkInvoice extended (amount +
  paymentTermDays); deterministic prefix `2026-000`; proxy seed credit
  €42.00 / `2026-0001` / 2026-08-10; full click → proxy sync → bus → ingest →
  strict-match → invoice PAID + matched transaction + RequiresReauth banner.
- **Step 19**: root `build:banking-api`, CONTEXT.md glossary, ADRs
  (docs/adr/0001–0003), AGENTS.md env tables, admin guides (en/nl) bank-import
  section.

## Auto-link accounts to companies by IBAN

`processBankSync` now calls `linkAccountsToCompaniesByIban` before the fetch
loop: every proxy account whose IBAN matches a `companies.iban` is
upserted into the local `bank_accounts` working set (linked / re-linked /
inserted) — no manual BankPage assignment needed. Accounts whose IBAN matches
no company stay unassigned (logged, still assignable manually). The raw
`sql\`...\`` amountDueExpression in `sync.ts` was converted to the Kysely
expression builder (correlated subqueries via `eb.selectFrom` +
`eb.fn.coalesce`), and the E2E specs now use the Kysely query builder instead
of raw `pg` SQL. Verified: unit tests (9/9 sync.spec, 65 api), the committed
E2E (24.4s) and the real-credentials spec (24.2s) — log line
`linked account … by IBAN` (real account, id via env).

## Assign removed; company filter added (2026-08-13)

- **Manual assign removed**: account linking is always done by IBAN
  (`linkAccountsToCompaniesByIban` during every sync). Removed the
  `assignAccount` tRPC mutation, `useAdminAssignBankAccountMutation`, the
  BankPage "Available accounts" section + assign script, and the
  `assign`/`availableAccounts`/`noAvailableAccounts` lang keys. The
  `getAvailableAccounts` procedure now returns only the assigned working set.
- **BankPage company filter**: the transactions tab gained a multi-select
  company filter (QSelect `multiple`, empty = all companies). `listTransactions`
  accepts `companyIds[]` (Kysely `in` filter on `bankAccounts.companyId`); the
  app query is reactive on the filter ref. Companies come from
  `useAdminGetCompaniesQuery`.

## Company filter fix (2026-08-13)

- **Bug**: the BankPage company filter sent option **objects** to
  `listTransactions` (`companyIds[0]` expected number, got object) — Quasar
  QSelect defaults `emit-value` to false, so the `v-model` held
  `{label, value}` objects instead of the numeric ids. Added `emit-value`
  `map-options` to the QSelect.
- New committed E2E `banking-company-filter.spec.ts` (2 accounts across 2
  companies, 1 transaction each): select company → 1 row, deselect → empty =
  all → 2 rows, multi-select → 2 rows. Passes.

## E2E specs (structure + mock, real-life as reference)

- `_auto-link.tmp.spec.ts` — auto-link by IBAN with MOCKED fixtures (seed
  structure: fake Knab IBAN + seed credit). Passed 23.2s.
- `_connection.tmp.spec.ts` — open-banking.io connection check; runs only with
  `BANKING_TEST_CONNECTION=1`. Passed 4.1s.
- `_real-life.tmp.spec.ts` — reference/validation against the real sync;
  fixtures passed via `BANKING_TEST_*` env vars (never hardcoded). Passed
  24.4s with the real credentials.
- All three are excluded from the default suite (`**/*.tmp.spec.ts`) and run
  via `playwright.real.config.ts`.

## Real-life verification (2026-08-13)

Ran a real end-to-end validation with the actual open-banking.io credentials
(`env/credentials.json`, base64 → `OPENBANKING_CREDENTIALS_JSON` on the
banking-api container). No real banking data is committed: fixtures are
mocked (seed structure) or passed via `BANKING_TEST_*` env vars; the
connection check runs behind `BANKING_TEST_CONNECTION=1`.

- Real sync through the proxy — the user's actual **Knab** account
  (the user’s Knab account, IBAN/id via env) — 84 real
  transactions ingested into the SlimFact working set.
- A real incoming credit (reference + amount + booking date passed via env)
  strict-matched a designed invoice and **auto-applied → invoice PAID**.
- `tests/e2e/_real-life.tmp.spec.ts` (temp, excluded from the default suite
  via `**/*.tmp.spec.ts` testIgnore) passed 22.0s; the committed
  `banking-proxy.spec.ts` still passes (24.1s) with credentials present.
- config.test.json now also grants the real account id to the e2e-test key.

## What changed (files)

- `@modular-api/event-bus` (modular-api): package + bus/server/client + tests +
  changeset.
- `packages/banking-api/**` (new): config, kysely, api-keys, banking, trpc,
  pgboss, seed, scripts, server/bootstrap, tests.
- `packages/api`: banking/client.ts (proxy), events.ts (relay), sync.ts
  (ingest), pgboss.ts (processBankSync), trpc/admin/bankTransactions.ts,
  setup.ts (eventBus + /ws), config/env.ts, package.json (ws dep).
- `packages/app`: trpc.ts/trpcLinks.ts (wsLink), useBankSyncNow, BankPage,
  lang keys.
- Infra: Dockerfile, docker-compose.test.yaml, playwright.config.ts
  (host-resolver), pnpm-workspace.yaml + patches/vitrify patch.
- Docs: CONTEXT.md, docs/adr/0001–0003, AGENTS.md, admin guides, root
  package.json build scripts.
