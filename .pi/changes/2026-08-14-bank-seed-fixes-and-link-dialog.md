# 2026-08-14 bank seed fixes + link-companies dialog

## Symptom

The open-banking test setup showed only `2026-0001` and the review queue had no
invoices to link transactions to.

## Root cause

`packages/api/tests/unit/banking/{apply,sync,accountLinks}.spec.ts` run
`TRUNCATE companies, checkout.invoices, ... CASCADE` in `beforeEach` against the
shared test DB (when `TEST_DATABASE_URL` is set). That wiped the seeded demo
world (Acme Inc/Rabo BV, bank links, invoices A–E) and left a unit-test fixture
("Test BV" + an invoice `2026-0001`). The seed's `if (!demoInvoice)` guard then
matched that leftover invoice and skipped the whole demo block.

## Changes

- `packages/api/src/kysely/seeds/test.ts`
  - Demo-block guard scoped to Acme (`companyId = acme.id`) so leftover rows
    from other companies can never block the demo world.
  - Numbering follows the app flow: `initialNumber` is read from
    `initialNumberForPrefixes` and passed to every `openInvoice` (same seam as
    `trpc/admin/invoices.ts`); the hardcoded `1..5` tuple loop is gone.
  - Bank links stay a direct `insertInto('bankAccountCompanies')` — importing
    the banking module (`accountLinks → sync → match`) would drag `date-fns`
    (a devDependency, build-time only) into the deployed node_modules and add
    ~11 MB to the image.
- `packages/banking-api/src/seed/test.ts`: removed the `db.destroy()` wrapper
  (`seedTest().catch(...)` only).
- `packages/api/src/kysely/seeds/fake.ts`: statuses loop now follows
  `createInvoice → openInvoice → addPaymentToInvoice → setInvoiceStatus`. No
  more number-less OPEN/PAID invoices (was 2 OPEN + 2 PAID without numbers).
  BILL/CONCEPT unnumbered is valid; RECEIPT via fully-paid bill + conversion.
- `packages/app/src/pages/admin/BankPage/BankSettingsPage.vue`: the inline
  company QSelect per account row is now a "Link companies" button opening a
  `ResponsiveDialog` (same component as the admin forms) with the multi-select
  and a Submit button. i-mdi icons (`i-mdi-link`, `i-mdi-close`).
- `packages/app/src/lang/{en-US,nl,de,index}.ts`: `bank.actions.linkCompanies`.
- `packages/api/tests/e2e/banking-company-filter.spec.ts`: settings round-trip
  updated to the dialog flow (button → dialog → select Rabo BV → Submit).
- `pnpm-workspace.yaml`: pinned `typescript: 6.0.3` (override) — fixes
  `vue-tsc@3.3.9` crashing with `ERR_PACKAGE_PATH_NOT_EXPORTED` on TS 7
  (removed `./lib/tsc` subpath).

## Verification

- Fresh stack (`down --volumes` + `up -d --wait`): demo invoices
  `2026-0001..0005` (A/C/D open, B paid + manual banktransfer, E paid + linked
  `bank:seed-credit-001`); both accounts linked to Acme;
  `initial_number_for_prefixes` = 1.
- No number-less OPEN/PAID invoices remain (open 5/5 numbered, paid 4/4).
- Banking E2E suite green: banking-proxy, banking-review, banking-company-filter
  (4/4, including the dialog round-trip).
- Dialog verified live: "Link companies" → dialog with account title, company
  multi-select (current links preselected), Submit persists.

## Gotchas for future runs

- Seed is not idempotent at base level (unique emails/prefixes) — always
  `down --volumes` before `up` or the API container crashes on duplicate
  clients.
- Unit DB specs still `TRUNCATE` the shared DB when `TEST_DATABASE_URL` is set
  — run E2E before `pnpm test`, or re-seed afterwards. (Unchanged; pointing
  unit tests at a separate DB is a design decision left to the user.)
- `vue-tsc -p tsconfig.json` still reports `vitrify/client` missing
  (TS2688) — vitrify@0.26.14 exports `./client` → `client.d.ts` which doesn't
  exist in any patch variant. Pre-existing packaging gap; the docker build's
  vitrify pipeline is unaffected.
