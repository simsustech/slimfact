---
"@slimfact/tools": patch
"@slimfact/api": patch
"@slimfact/banking-api": patch
---

Consolidate money parsing in @slimfact/tools/banking.

`parseAmountToCents` / `centsToAmountString` existed as two drifting copies
(`@slimfact/api/src/banking/money.ts` and
`@slimfact/banking-api/src/banking/money.ts` — the latter missing
`centsToAmountString`). Per ADR-0006, framework-free banking logic has one home,
so both now re-export the single implementation in `@slimfact/tools/banking`.
No behaviour change.
