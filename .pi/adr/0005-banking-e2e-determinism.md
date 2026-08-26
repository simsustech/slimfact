# ADR-0005: Banking E2E determinism (ingest disabled in tests, seed:fake scoped away)

- **Status:** accepted (2026-08-18)
- **Scope:** `packages/api`, `docker-compose.test.yaml`, `packages/api/src/kysely/seeds/fake.ts` (worktree `open-banking`)

## Context

The banking E2E specs (`banking-proxy`, `banking-company-filter`,
`banking-review`, `banking-link`) assert against a seeded demo world (Acme +
Rabo BV). Two non-deterministic inputs could mutate that world mid-run:

- The ingest worker (`processBankSync`) auto-links strict matches whenever it
  runs — scheduled by `BANKING_SYNC_CRON` or triggered by the "Sync now"
  button. The test stack disabled the cron (`BANKING_SYNC_CRON: disabled`) but
  nothing _enforced_ "no ingest": a stray job or manual trigger could still
  link transactions between two assertions.
- `seed:fake` created invoices on **any** company (including Acme/Rabo BV,
  whose demo invoices the specs count on) and used unseeded `Math.random()`,
  so the fake data was neither scoped nor reproducible.

## Decision

- **Ingest guard:** the SlimFact ingest worker is disabled via the
  `BANKING_INGEST_DISABLED` env flag, set to `true` in
  `docker-compose.test.yaml`. `processBankSync` (the single choke point every
  ingest job crosses) early-returns a no-op result when the flag is set and
  logs a warning. The flag defaults to `false` in all non-test environments.
- **seed:fake scoping + determinism:** the fake seed now selects **only** the
  generated `data.json` companies (`fakeCompanies`, matched by name) for its
  client invoices, statuses and subscriptions — never Acme/Rabo BV — and
  replaces `Math.random()` with a fixed-seed `mulberry32` PRNG, so the fake
  data is reproducible across runs.

## Consequences

- Banking E2E observes a stable, unlinked seed world: no mid-run auto-apply
  races, and the demo invoices (`2026-0001..0012`) stay exactly the seeded
  set regardless of fake-seed randomness.
- `seed:fake` output is reproducible (same seed → same data), which also
  stabilises any other suite that depends on it.
- A misconfigured non-test stack that sets the flag logs a `warn`, so the
  silent-disabled state is diagnosable.
