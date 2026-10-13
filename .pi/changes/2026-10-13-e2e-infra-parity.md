# 2026-10-13 — E2E infra parity with petboarding

## Why

The auth-reuse speedup landed first; this ports the rest of petboarding's
E2E infrastructure (`0ecd27e6d` and neighbours) that SlimFact lacked.

## What

- **`packages/api/tests/e2e/stack-lifecycle.ts`** (new) + `tests/unit/stack-lifecycle.spec.ts`
  — `shouldOwnStack(env)` and `composeFiles(env)`. The stack lifecycle moves out
  of `global-setup` so a single config can own *or* reuse a stack:
  - `E2E_OWN_STACK=0` → skip down/build/up and use the running stack (the auth
    capture still runs, unlike the old `playwright.nosetup.config.ts` which sets
    `globalSetup: undefined`).
  - `E2E_COMPOSE_FILES` → colon/comma-separated overlay files, resolved against
    the repo root, so the Mollie/Stripe PSP overlays run through the default
    config (`E2E_COMPOSE_FILES=docker-compose.test.mollie.yaml`).
- **`global-setup.ts`** — uses the module; owns the stack by default, otherwise
  logs and skips; captures auth in both modes.
- **`playwright.config.ts`** — `timeout: 60_000`, `screenshot: 'only-on-failure'`,
  `video: 'on-first-retry'`, `slowMo` opt-in via `PLAYWRIGHT_SLOWMO`.
- **`.github/workflows/test staging.yaml`** — install only chromium
  (`playwright install --with-deps chromium`) and pin `PLAYWRIGHT_ALLOW_SCREENSHOTS: ''`.
- **`.github/scripts/act-e2e-workflow.test.sh`** (new) — run the e2e workflow
  locally via act (host-gateway entry for `slimfact.localhost`).
- **`AGENTS.md`** — document `E2E_OWN_STACK` / `E2E_COMPOSE_FILES`.

## Verification

- `pnpm exec vitest run tests/unit/stack-lifecycle.spec.ts` → 6 passed.
- `E2E_OWN_STACK=0 pnpm exec playwright test … -g "company select lists …"` →
  `[global-setup] E2E_OWN_STACK=0 — leaving the stack untouched`, then the auth
  capture, then the test passes (1 passed).
- `pnpm run format:check` / `pnpm run lint` clean.

## Notes

- `playwright.nosetup.config.ts` stays for the documented PSP commands;
  `E2E_OWN_STACK=0` is the better replacement (it also captures auth).
- The lens flags `process` in `playwright.config.ts`: the file is in no
  tsconfig (build is `vitrify`, lint is `oxlint src`), so the lens type-checks
  it in a fallback program without `@types/node`. Pre-existing, not a real error.
