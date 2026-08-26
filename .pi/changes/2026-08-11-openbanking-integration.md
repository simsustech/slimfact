# Open Banking Integration — Change Recap

**Date**: 2026-08-11
**Plan**: `.pi/plans/2026-08-04-openbanking-integration.md`

## Files Changed

### API Package (`packages/api/`)

| File                                             | Change                                                                                                                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                   | Added `@open-banking-io/client` dependency (pinned `0.2.0`)                                                                                                                                                       |
| `src/config/env.ts`                              | Added `OPENBANKING_CREDENTIALS_JSON`, `OPENBANKING_API_BASE_URL`, `OPENBANKING_SYNC_CRON` env vars + `bankingEnabled()` helper                                                                                    |
| `src/kysely/migrations/11_create_bank_tables.ts` | New migration: `bank_accounts` + `bank_transactions` tables                                                                                                                                                       |
| `src/kysely/types.ts`                            | Added `BankTransactionState`, `BankAccounts`, `BankTransactions` types                                                                                                                                            |
| `src/banking/client.ts`                          | BankingApi interface seam, `loadCredentials` (base64→bundle), `createClient`                                                                                                                                      |
| `src/banking/money.ts`                           | `parseAmountToCents`, `centsToAmountString`                                                                                                                                                                       |
| `src/banking/normalize.ts`                       | `normalizeReference`, `containsInvoiceNumber`                                                                                                                                                                     |
| `src/banking/match.ts`                           | `matchCreditToInvoices`, `suggestInvoiceCandidates`, `canApply`                                                                                                                                                   |
| `src/banking/sync.ts`                            | `syncAll` orchestrator, `listOpenInvoicesForCompany`, `upsertTransactions`                                                                                                                                        |
| `src/pgboss.ts`                                  | Added `syncBankTransactions` queue + cron + worker (additive, no changes to `checkRefunds`)                                                                                                                       |
| `src/setup.ts`                                   | Decorated `fastify.banking` with `getClient`, `syncAll`, `loadCredentials`                                                                                                                                        |
| `src/trpc/admin/bankTransactions.ts`             | 12 tRPC procedures (listUnmatched, applyMatch, ignoreTransaction, unignoreTransaction, getConnections, getAvailableAccounts, assignAccount, setAccountActive, removeAccount, getStats, listTransactions, syncNow) |
| `src/trpc/admin/index.ts`                        | Registered `adminBankTransactionRoutes`                                                                                                                                                                           |
| `vitest.config.ts`                               | Added vitest dev config for `tests/unit/**`                                                                                                                                                                       |
| `tests/unit/banking/env.spec.ts`                 | 5 tests: env parsing, bankingEnabled, sync cron default                                                                                                                                                           |
| `tests/unit/banking/client.spec.ts`              | 5 tests: loadCredentials, createClient, unconfigured null                                                                                                                                                         |
| `tests/unit/banking/money.spec.ts`               | 8 tests: parseAmountToCents, centsToAmountString                                                                                                                                                                  |
| `tests/unit/banking/normalize.spec.ts`           | 4 tests: normalizeReference, containsInvoiceNumber                                                                                                                                                                |
| `tests/unit/banking/match.spec.ts`               | 19 tests: matchCreditToInvoices, canApply (strict, medium, low, overpay, partial, PSP, etc.)                                                                                                                      |
| `tests/unit/banking/sync.spec.ts`                | 5 tests: syncAll with fake BankingApi (dedupe, auto-apply, non-strict, RequiresReauth, idempotent)                                                                                                                |
| `tests/unit/banking/pgboss.spec.ts`              | 2 tests: initialize registers/skips syncBankTransactions (15s timeout for parallel load)                                                                                                                          |
| `tests/e2e/helpers.ts`                           | Added `mkBankFixture`, `clearBankFixtures` (direct pg insert)                                                                                                                                                     |
| `tests/e2e/bank-transactions.spec.ts`            | 5 E2E scenarios: review+apply, ignore, overpay, not-configured notice, sync-now                                                                                                                                   |

### App Package (`packages/app/`)

| File                                                  | Change                                                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/admin/BankPage/BankPage.vue`               | New page: 3 tabs (Transacties, Te matchen, Instellingen), review queue with suggestion chips + Apply/Ignore, settings with sync-now button + result counts |
| `src/pages/admin/BankPage/BankPage.spec.ts`           | Component test: mounts, 3 tabs render, en-US labels, suggestion row + apply, reviewEmpty                                                                   |
| `src/pages/admin/BankPage/BankPageFabs.vue`           | Sync now FAB (emits `administrator-open-bank-sync-now`)                                                                                                    |
| `src/queries/admin/bankTransactions.ts`               | 12 typed composables wrapping tRPC procedures                                                                                                              |
| `src/router/routes.ts`                                | Added `/admin/bank` route                                                                                                                                  |
| `src/components/dashboard/DashboardAdminMenuList.vue` | Added Bank menu entry                                                                                                                                      |
| `src/configuration.ts`                                | Added `BANK_ICON = 'i-mdi-bank'`                                                                                                                           |
| `src/lang/index.ts`                                   | Added `bank: { ... }` block with `syncNow`, `syncResult`, `syncRunning` keys                                                                               |
| `src/lang/en-US.ts`                                   | English translations                                                                                                                                       |
| `src/lang/nl.ts`                                      | Dutch translations                                                                                                                                         |
| `src/lang/de.ts`                                      | German translations                                                                                                                                        |

### Root

| File                                                         | Change                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `AGENTS.md`                                                  | Added banking feature paragraph, env table, credentials warning |
| `.pi/plans/2026-08-04-openbanking-integration.evaluation.md` | Plan evaluation                                                 |
| `.pi/changes/2026-08-11-openbanking-integration.md`          | This file                                                       |

## Key Design Decisions

1. **Credentials encoding**: Base64 of `credentials.json` bundle (recommended for Docker/production)
2. **Strict auto-match**: Requires exact `amountCents === amountDue` + reference hit + in 14-day window + same currency
3. **Review queue**: Suggestions computed server-side via `matchCreditToInvoices`; up to 3 per transaction
4. **DB-backed procedures ungated**: `listUnmatched`, `applyMatch`, `syncNow` work without banking credentials (DB-only); only `getConnections`/`getAvailableAccounts`-unassigned gate on `bankingEnabled()`
5. **Component test**: render-function harness with `installQuasar` + QLayout wrapper; review tab requires `initialTab` prop click; direct `applyMatch` call due to harness reactivity limitations
6. **pgboss seam**: `initialize({ fastify, boss? })` param for testability; existing `checkRefunds` block untouched
