# 2026-09-17 — prune superseded open-banking connections

## Why

Reconnecting a bank (Knab) made it show up once per reconnect on
`/admin/settings/banking`. open-banking.io issues a **new session id per
authorisation**, `upsertConnections` only inserts/updates by session id, and
nothing ever deleted a row — while `machine.listConnections` returned every row
for the ASPSP. The SDK exposes no revoke/delete call, so the cleanup is local
bookkeeping; connection rows are only a cache for the settings page (the sync
works from live API responses, and accounts/balances/transactions are keyed by
their own external ids with no FK to `connections`).

## What changed

- `packages/banking-api/src/banking/connections.ts` (new): `connectionUsable`
  (Active + consent not lapsed), `connectionGroupKey`, `keepConnectionIds`,
  `findStaleConnections`, `pruneConnections`. Per ASPSP the keep set is the
  **newest** row (a session that still needs authorising stays visible) plus the
  **newest usable** row (a reconnect never hides the only working session);
  everything else is superseded or expired.
- `packages/banking-api/src/banking/sync.ts`: prunes after each
  `upsertConnections`, and the reauth check now reuses `connectionUsable`
  (behaviour unchanged — it was `status !== "Active" || validUntil < now`).
- `packages/banking-api/src/trpc/machine.ts`: `listConnections` filters with the
  same rule, so the page is clean immediately instead of after the next sync.
- `packages/banking-api/scripts/prune-connections.ts` (new) +
  `pnpm prune-connections [--dry-run]`: on-demand cleanup for rows already in the
  database (the image needs a rebuild to ship either path).
- Docs: README bullet + Scripts row, AGENTS.md connections paragraph, and the
  `.changeset/prune-superseded-bank-connections.md` release note.
- Tests: `tests/unit/connections.spec.ts` (13), one `trpc.spec.ts` case for the
  read path, one `sync.spec.ts` case proving the automatic prune.

## Verified

- E2E on seeded duplicates (old Knab `Revoked`/2020 + new Knab `Active` +
  Rabobank `Active`, plus account/transaction/balance): dry-run listed 1 stale of
  3, the run deleted exactly that one, a second run deleted 0, and bank data was
  untouched.
- Full package suite: 95 passed / 4 skipped, the only failure the pre-existing
  environmental `demo-seed` hook timeout (needs the api's `checkout.invoices`).
  The existing "persists connections…" assertion still holds — Knab and Rabobank
  are separate ASPSP groups.
