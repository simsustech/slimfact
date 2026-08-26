# ADR-0001: Reusable `@modular-api/event-bus` package

- **Status:** accepted (2026-08-12)
- **Scope:** `@modular-api/event-bus` (modular-api repo, branch `event-bus`)

## Context

The BankPage "Sync now" button needs realtime feedback when a bank sync
finishes. The sync runs in the banking-api proxy (server-to-server) while the
button lives in the browser. Options: polling, SSE, or a shared pub/sub.

## Decision

A reusable `@modular-api/event-bus`: tRPC WebSocket pub/sub with typed topics,
in-memory only, auth-agnostic. It is used client↔server (browser ↔ SlimFact
backend) and server↔server (SlimFact backend ↔ banking-api proxy). Auth is an
app-supplied `authenticate` hook: OIDC `connectionParams` for browsers,
API-key headers for servers.

## Consequences

- One generic pub/sub instead of per-app polling or SSE.
- Events are status pushes, not data — in-memory suffices (no durability).
- A connection is identified by its `authenticate` result; `canSubscribe`
  gates topic globs per identity.
