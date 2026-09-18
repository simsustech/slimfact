# @slimfact/banking-api

## 0.1.1

### Patch Changes

- d4253f2: Consolidate money parsing in @slimfact/tools/banking.

  `parseAmountToCents` / `centsToAmountString` existed as two drifting copies
  (`@slimfact/api/src/banking/money.ts` and
  `@slimfact/banking-api/src/banking/money.ts` — the latter missing
  `centsToAmountString`). Per ADR-0006, framework-free banking logic has one home,
  so both now re-export the single implementation in `@slimfact/tools/banking`.
  No behaviour change.

- a449955: Prune superseded open-banking connections.

  open-banking.io issues a new session id per authorisation, so reconnecting a bank
  left the previous row in `open_banking.connections` forever and the bank settings
  page listed the same bank once per reconnect — nothing ever removed it
  (`upsertConnections` only inserts/updates by session id).

  `runSync` now prunes after each upsert, and `machine.listConnections` filters the
  same way, so the page shows one connection per ASPSP again. Kept per ASPSP: the
  newest row (a session that still needs authorising stays visible) and the newest
  usable row (a reconnect never hides the only working session). Accounts, balances
  and transactions are untouched — connection rows only feed the settings page, and
  the sync works from the live API responses.

  `pnpm prune-connections [--dry-run]` / `node dist/scripts/prune-connections.js`
  does the same on demand, for rows that are already stored.

- Updated dependencies [d4253f2]
- Updated dependencies [d4253f2]
- Updated dependencies [ac65632]
- Updated dependencies [d4253f2]
- Updated dependencies [d4253f2]
  - @slimfact/tools@0.9.2
