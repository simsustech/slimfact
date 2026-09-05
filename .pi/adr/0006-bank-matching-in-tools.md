# ADR-0006: Bank matching engine lives in @slimfact/tools/banking

**Status:** Accepted  
**Date:** 2026-09-05  
**Supersedes:** Partially ADR-0004's "unmatched credits in ledger" consequence

## Context

ADR-0004 placed the bank ledger (unmatched credits) inside the payments page. The matching logic lived in `@slimfact/api/src/banking/match.ts`, tightly coupled to the api's kysely DB layer and `@modular-api/fastify-checkout` types.

As the matching engine grew (Fuse.js fuzzy client matching, adoption detection, settlement recognition), keeping it in the api package created friction: the engine couldn't be unit-tested independently of the database, and the app needed shared types without importing api internals.

## Decision

1. **All matching logic** (`matchCreditToInvoices`, `suggestInvoiceCandidates`, `buildLinkProposal`, `canApply`, `matchSettlementForCredit`, `findAdoptablePayment`, `normalizeReference`, `containsInvoiceNumber`, `canonicalName`, `suggestForCredit`) lives in `@slimfact/tools/banking`. The package is framework-free (no kysely, no checkout plugin).

2. **The api** is a thin data+writes caller: it assembles DB rows, passes them to the tools engine, and writes results back.

3. **The app** imports shared wire types (`MatchTransaction`, `MatchInvoice`, `BankPaymentCandidate`, `LinkProposal`, etc.) from `@slimfact/tools/banking` — no api import needed for type-only usage.

4. **Unmatched bank credits** no longer render inside the payments ledger. They get their own **Suggestions** tab on `/admin/payments` (`?tab=suggestions`), surfaced via `listSuggestions` which calls `suggestForCredit` per credit.

## Rationale

- **Multi-tenant:** one `banking-api` serves many slimfact DBs; the matching engine must not assume co-located SQL. TypeScript over HTTP satisfies this constraint.
- **Testable:** pure functions in tools, no DB dependency. DB-backed verification specs live in `@slimfact/api/tests/unit/banking` and import from tools.
- **Single source of truth:** one engine, one set of types, one behavior — consumed by api (data assembly + writes), app (type imports), and tools tests.
- **KISS:** the engine uses plain predicates for deterministic gates and Fuse.js for fuzzy client matching. No external ML services.

## Consequences

- `@slimfact/tools` gains a `fuse.js` dependency.
- `api/src/banking/match.ts` and `api/src/banking/normalize.ts` are deleted; all api imports relink to `@slimfact/tools/banking`.
- ADR-0004's "unmatched credits in ledger" consequence is superseded: credits now live in the Suggestions tab.
- The `open_banking.suggestions` table is dropped (banking-api migration 004) — it was never read.
