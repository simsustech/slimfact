# ADR-0002: Banking proxy owns the open-banking.io sync

- **Status:** accepted (2026-08-12)
- **Scope:** `packages/banking-api` (slimfact worktree `open-banking`)

## Context

open-banking.io credentials (including a P-256 decryption key) previously
lived in the SlimFact api container, which called the SDK inline during its own
cron sync. The SDK, credentials, and sync cadence were coupled to the whole app
deploy.

## Decision

A new proxy service `packages/banking-api` owns the open-banking.io
integration: it holds the credentials bundle, runs its own pg-boss queue
(cron + on-demand enqueue, max once per minute), and exposes data over tRPC
with per-key API-key grants. SlimFact reads the proxy instead of the SDK and
keeps its local `bank_accounts` / `bank_transactions` as a working set for
matching and the review queue.

## Consequences

- Single source of truth; the vendor SDK is confined to one service.
- SlimFact and the proxy decouple their deploy cadences.
- Credentials are never in the SlimFact image; the proxy is on an internal
  network with zero published ports.
