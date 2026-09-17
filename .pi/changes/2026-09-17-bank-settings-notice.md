# 2026-09-17 — bank settings not-configured notice

## Why

The banner on `/admin/settings/banking` told operators to set
`OPENBANKING_CREDENTIALS_JSON` to enable bank import. That is **banking-api's**
variable (it feeds the proxy's open-banking.io client) and cannot affect this
banner: it renders when `bankingEnabled()` is false, which needs
`BANKING_API_URL` **and** `BANKING_API_KEY` on the SlimFact api service. Setting
either one alone still shows it (the api's env spec pins the key-without-url case
as "no URL → zombie cron").

## What changed

- `packages/app/src/lang/{en-US,nl,de}.ts`: `bank.notConfigured` now names
  `BANKING_API_URL` and `BANKING_API_KEY` on the SlimFact api service.
- `packages/api/tests/e2e/banking-review.spec.ts`: the assertion is byte-equal to
  the new en-US string.
- `packages/app/tests/unit/bankSettingsNotice.test.ts` (new): asserts every
  locale names both api variables and mentions neither a banking-api variable nor
  `POSTGRES_`. The e2e is not a guard here — it skips itself whenever a stack runs
  with banking configured (the normal case), so a wrong message would sail
  through.

## Verified

- Locale parity + the assertion equality were checked by loading the three locale
  objects and the spec; no locale string mentions `OPENBANKING_CREDENTIALS_JSON`
  any more and the `bank.*` key sets are unchanged.
- App suite: 10 files / 75 tests pass (2 new); `oxfmt --check` and `oxlint` clean
  (`src/tools.ts` has a pre-existing unused-catch warning).
