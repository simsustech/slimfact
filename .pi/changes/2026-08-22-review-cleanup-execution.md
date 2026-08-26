# 2026-08-22 — Open-banking review cleanup (full plan execution)

Executed `/home/stefan/.pi/plans/2026-08-22-open-banking-review-cleanup.md`:
all blockers, majors, minors and UX findings from the full-worktree review.

## What changed

### Shared types (tools)

- **NEW** `packages/tools/src/banking/types.ts` — wire-level bank types
  (`Coverage`, `LinkProposal`, `PspSettlement`, `SettlementPayment`,
  `OverviewRow`, `ApplyResult`, …) exported via new `"./banking"` subpath.
- `packages/app/src/queries/admin/bankTransactions.ts` — hand-mirrored type
  block replaced by imports/re-exports from tools; `BankTransaction` derived
  as `OverviewRow['transaction']`.
- `packages/api/src/banking/match.ts` — exported compile-time contract check
  (`LinkProposalSharedContractCheck`) proving api proposals satisfy the wire
  contract.

### Security / correctness — banking-api

- `trpc/machine.ts`: PSP routes scoped to key grants; `getSyncStatus` returns
  `hasError: boolean` instead of leaking internal error text.
- `seed/test.ts`: `seedPspFixture()` now awaited inside `seedTest()`.
- `kysely/index.ts` + `config/postgres.ts`: TLS `rejectUnauthorized` defaults
  true; downgrade only via `POSTGRES_SSL_INSECURE=true`.
- `config/env.ts`: zod-validated integer env vars; rate limit default
  1,000,000 → 600/min.
- `banking/client.ts`: loud warning on malformed credentials (no contents).
- `banking/sync.ts`: typed error classification (status/code first).
- `config/keys.ts` + `server.ts`: unknown-account warning computed once.
- Unit tests: env/tls/classification/trpc-grant specs (74 total, green).

### Correctness — api

- `banking/apply.ts`: adoption UPDATE + PSP reconcile wrapped in the
  unique-violation catch (no raw 23505 under concurrency); pre-guard skips
  cancelled invoices; post-apply re-check surfaces concurrent-cancel case in
  `ApplyResult.error`.
- `config/env.ts`: `bankingEnabled()` requires key AND URL (no zombie cron).
- `trpc/admin/bankTransactions.ts`: date-string zod validation;
  `setAccountCompanies` FK-validates company ids.
- Migrations **11 + 12 deleted** (create/drop pair never shipped — squashed).

### E2E infra

- helpers.ts: shared `getTestDb()` (independent pool per call) +
  `ADMIN_EMAIL/ADMIN_PASSWORD`; all banking specs deduped onto them.
- `banking-company-filter.spec.ts` merged into `banking-link.spec.ts`
  (serial file = no parallel mutation of seeded state); settings round-trip
  moved to end (it persistently mutates account links).
- `waitForTimeout(800)` drawer waits → expect.poll.
- `banking-proxy.spec.ts` renamed to what it actually asserts.
- `fillComboboxes` hardened: dialog-animation settle + retry with Escape
  reset (see known issue below).

### Frontend UX (packages/app)

- Notify-based error/success feedback in link dialog + settings page (silent
  `catch { done(false) }` gone); sync errors surfaced via friendly lang keys.
- `useBankSyncNow.syncResult` now discriminated `{ kind, ... }`.
- Overview: amber "not configured" banner when banking disabled.
- Settings: translated status chips, date-fns-free Intl dates, grouped IBANs.
- Shared money formatter `utils/money.ts` (Intl.NumberFormat, currency-aware)
  replaces hardcoded-€ formatters everywhere on Bank pages.
- Link dialog: formatted due dates, exact-fit candidate highlight,
  check_circle instead of decorative checkboxes.
- Icon-only actions: lang-driven aria-label/title + data-testids
  (`bank-link`, `bank-view-linked`, `bank-settlement-details`).
- Company filter: select-all watchEffect hack removed (empty = all).
- Filters persisted to URL query params.
- i18n: all new keys added to en-US/nl/de.

### Build/deps

- vitrify spec pinned back to **0.26.14** in app+api package.json (the
  "update dependencies" commit bumped specs to 0.27.0 without regenerating
  the lockfile → ERR_PNPM_UNUSED_PATCH broke every install/docker build).
  Lockfile regenerated.
- AGENTS.md: migration-squash + spec-layout notes updated.

## Verification

- tsc clean: tools, app, api src, banking-api (only pre-existing k6/e2e-noise).
- Units: api 109 passed/33 skipped (DB-less skip), banking-api 38 passed/36 skipped.
- Builds: tools tsc ✓, app vitrify build ✓, api docker image builds ✓.
- Docker stack fresh (`down --volumes`, ports remapped via /tmp override):
  banking-link(13)+proxy(1)+review(1 skipped-by-design) = **14 passed**;
  extended: icons **3/3**, invoice-line-types ✓, account ✓.
- lint: only pre-existing warnings; format clean in all four packages.

## Known issues (pre-existing, NOT introduced here)

1. ~~Second+ create-dialog breaks~~ **RESOLVED during this session.** Three
   stacked root causes:
   a) `InvoiceForm.vue` handed a module-level `initialValue` object to
   `ref()` — line/discount mutations leaked into every subsequent dialog.
   Fixed with a `getInitialValue()` factory.
   b) The `'Lines Add'` locator matched an outdated DOM shape; the Lines
   header and Add button now render as separate nodes — replaced with a
   role-based `.getByRole('button', { name: 'Add' })` click in
   invoice-flow (2 sites) and administrator.spec (3 sites).
   c) npm `@simsustech/quasar-components@0.12.9` has broken QSelect menu
   behavior inside dialogs — the docker build MUST link the local
   checkout:
   `export LINKED_QUASAR_COMPONENTS_PATH=~/Projects/quasar-components/packages/components`
   (alongside the fastify-checkout/event-bus links). Without it, select
   menus never open in dialogs and most form E2Es fail.
   Also during diagnosis: specs migrated to fresh-page-per-test
   (invoice-flow, administrator), and `fillComboboxes` was hardened
   (dialog settle + enabled-waits + retry + option-pick restore).
   After all three fixes: full e2e suite **30 passed / 0 failed**
   (8 PSP skips without keys).
2. pnpm root scripts blocked by unused-patch guard if vitrify is ever bumped
   again without regenerating the lockfile.
3. WS `bank.sync.*` events still broadcast accountIds to every authenticated
   socket (single-tenant acceptable; noted for multi-key future).
4. Final sweep additions (all verified green after): banking-api `read()` no
   longer falls back to `VITE_`-prefixed env vars (server-side override
   surface removed); AGENTS.md proxy env table documents
   `RATE_LIMIT_PER_MINUTE` (600) and `POSTGRES_SSL`/`POSTGRES_SSL_INSECURE`,
   plus a test-only warning for the seeding entrypoint; `.gitignore` now
   excludes agent session dirs (`.pi/fff|continue|handoff|plans`).
5. Same-class bug fixed in `SubscriptionForm.vue`: module-level
   `initialValue` (lines/discounts/surcharges arrays) → `getInitialValue()`
   factory, and both forms' `setValue` watchers now merge from the factory.
   Audit of ClientForm / CompanyForm / NumberPrefixForm /
   InitialNumberForPrefixForm confirmed flat primitives only (safe).
   Verified on a rebuilt stack: administrator(6)+invoice-flow(5)+icons(2)
   = **13 passed**, incl. the Subscriptions dialog flow. Final gate: full
   e2e suite re-run on the final image = **30 passed / 0 failed** (8 PSP
   skips). Stack torn down afterwards.
6. Project-wide analyzer sweep (gitleaks/madge/jscpd/knip): no secrets,
   no circular deps, no duplication; knip findings are false positives
   (migrations/entrypoints/Kysely types). Recorded, not fixed: complexity
   hotspots addressed: `listTransactions` refactored — extracted
   `loadInvoiceIdByUuid`, `mapSettlementPayments` (dedupes two near-identical
   blocks), `resolveAccountRows` into module helpers (-74 inline lines).
   `processBankSync` (CC 42) left as-is for a dedicated session.
   Verification after refactor: tsc ✓, units 109 ✓, banking+invoice-flow
   E2E 19/19 ✓, full suite **30/0** ✓ on the refactored build. Round-trip
   test hardened with dialog settle + aria-selected toggle assertion (its
   one flake was a dirty-DB deselect — expected per no-reseed rule).
   nesting 7) — verified working, refactor candidates for a follow-up.

## Follow-up: PSP settlement recognition rework (2026-08-24)

Plan: `~/.pi/plans/2026-08-23-fix-psp-settlement-recognition.md` (interviewed,
user-approved). Model fixed for good: PSP → Settlement → Invoices (read-time
recognition) vs Bank → Transaction → Invoice(s) (link pipeline), never mixed.

- `matchSettlementForCredit` (match.ts): exact tier (amount+currency+14d
  window, closest-date tie-break) then hint tier (PSP name in counterparty/
  description + unique candidate); skips `failed` settlements; caller owns
  one-to-one consumption.
- `listTransactions`: recognition only for credits with NO existing bank-ref
  links (already-reconciled credits never steal a settlement — the seeded
  seed-credit-001/006 identical-amount trap); legacy applied rows stay settled
  via OR. Suggestion loop skipped for recognized payouts.
- Deleted: `LinkProposal 'psp'` (tools + api local union), buildLinkProposal
  psp branch/params, `applyLink mode:'psp'`, `reconcilePspPayout`, dialog
  reconcile template, `suggestionPsp` lang keys ×3, `hasPspHint` now also
  scans description/remittance ("MOLLIE SETTLEMENT 202" case).
- E2E: psp tests reworked to read-time assertions; round-trip hardened with
  aria-selected toggle check.
- Gates: tsc ✓, vitest 117 ✓, lint/format ✓, build ✓, fresh-stack E2E **30/0**.
- Notable finds during verification: seeded decoy settlement setl-seed-203
  (status 'failed') and inconsistent seed statuses ('paid_out', 'open') shaped
  the final status filter (`!== 'failed'`).

## Follow-up: rename seed company "Rabo BV" → "Acme Retail BV" (2026-08-24)

User request: the demo company name collided with the Rabobank bank name
(confusing next to Mollie/Rabobank rows). Renamed in `seeds/test.ts`
(name + email; IBAN/BIC keep RABO — there it legitimately means the bank) and
all 8 references in `banking-link.spec.ts`. Verified: units 117 ✓, fresh-stack
full E2E **30/0** ✓.

Ops note: a `docker compose build | tail` pipeline masked a build failure
(missing LINKED__exports → banking-api test typecheck failed on implicit any)
and `up` silently reused the stale image. Always export the three LINKED__ vars
and use `set -o pipefail` with compose build.

## 2026-08-25 — Admin "invoice paid" email notifications

Files: `~/Projects/modular-api/packages/fastify-checkout/src/{index,invoiceHandler}.ts` (new optional `onInvoicePaid` callback invoked on any →PAID transition, best-effort try/catch), `packages/api/src/notifications/invoicePaid.ts` (new: recipient resolution `ADMIN_NOTIFICATION_EMAIL` → fallback `companyDetails.email`, locale-aware template render, skip+warn when mailer/recipient missing), `packages/api/src/setup.ts` (wiring with lazy `fastify.mailer` getters — the nodemailer plugin decorates after setup), `packages/api/src/templates/email/invoice/paid/{en-US,nl-NL,de-DE}.ts` (new), `packages/api/src/config/env.ts` (+key), `AGENTS.md` (env row), tests: unit `invoicePaidNotification.spec.ts` (10 tests incl. real handlebars+glob render), E2E in `banking-review.spec.ts` (Sync now strict-apply → MailHog subject assertion; needs `BANKING_INGEST_DISABLED=false` + mailhog API port 18027 via /tmp/slimfact-port-override.yaml). Why: nothing notified anyone when an invoice became PAID; one seam (`setInvoiceStatus`) covers PSP webhook, bank-sync auto-apply/adoption and manual payments. Host-side testing requires repointing `packages/api/node_modules/@modular-api/fastify-checkout` → local modular-api source AND aligning its fastify to 5.12.1 (`ln -sfn` into fastify-checkout/node_modules) to avoid duplicate FastifyInstance types.
