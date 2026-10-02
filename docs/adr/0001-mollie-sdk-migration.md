# 0001. Migrate the Mollie integration to `mollie-api-typescript`

- Status: accepted — 2026-10-01
- Deciders: stefan (+ pi `/plan`)

## Context

Mollie supersedes its legacy Node SDK `@mollie/api-client` with the Speakeasy-generated official SDK `mollie-api-typescript`. Per the upstream README (mollie/mollie-api-typescript), new features land only in the new SDK and the legacy SDK enters maintenance mode after **2027-02-10**.

SlimFact touches the Mollie SDK from two places that live in two repositories:

- **Settlement ingestion** — `packages/banking-api/src/banking/pspAdapters.ts` (the `PspAdapter` for `runPspSync`).
- **Payment handling** — `@modular-api/fastify-checkout`'s `paymentHandlers/mollie.ts` (create / settle / cancel / refund, linked locally from `~/Projects/modular-api`).

## Decision

All first-party code targets `mollie-api-typescript`: exact pin `1.12.37` in SlimFact (this repo pins exact), caret `^1.12.37` in modular-api (that repo's convention). Both call sites migrate in the same effort, gated by a live test-mode smoke / E2E parity run (plan: `~/.pi/plans/2026-10-01-replace-mollie-package.md`).

## Consequences

- Both packages coexist in SlimFact's lockfile **until** `@modular-api/fastify-checkout` ≥ 0.11.1 is published and wired: `packages/api` resolves the legacy SDK through fastify-checkout 0.11.0 and keeps it in vitrify's `serverModules` externalization list until then. A zero-hit grep for `@mollie/api-client` under `packages/` is the completion gate — not the first step.
- The new SDK's `SignatureValidator` (Mollie webhook HMAC signatures) is now available but **not adopted**; webhook verification remains a documented follow-up in fastify-checkout.
- Speakeasy regenerates releases frequently; SlimFact's exact pin plus `minimumReleaseAge: 1440` means upgrades are deliberate, not ambient drift.
