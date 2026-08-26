# ADR-0003: SlimFact keeps a local banking working set

- **Status:** accepted (2026-08-12)
- **Scope:** `packages/api` (slimfact worktree `open-banking`)

## Context

After decoupling, SlimFact could read bank data statelessly from the proxy on
every page load. The review-queue UX (suggestions, manual apply), the existing
E2E seeding surface, and replay safety argue for a local copy.

## Decision

SlimFact keeps `bank_accounts` / `bank_transactions` as a local working set.
The ingest worker (driven by `bank.sync.*` events) upserts proxy data into
these tables, strict-matches credits against open invoices, and auto-applies
them via the checkout `addPaymentToInvoice`. The proxy remains the source of
truth; the local tables are a derived snapshot.

## Consequences

- The review queue and E2E seeding keep working unchanged.
- Re-syncs are idempotent (upsert by external id; matched state preserved).
- A proxy outage does not erase already-ingested data.
