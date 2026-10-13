# 2026-10-13 — E2E suite speed: reuse the admin login

## Why

The suite's per-test cost was dominated by `login()`, which walked the full
OIDC round-trip for every test (14 spec files, ~90 tests). A minimal
login + one assertion cost ~1.3s of that in login alone.

## What

Ported the petboarding approach (`0ecd27e6d`):

- **`packages/api/tests/e2e/auth-state.ts`** (new) — capture the seeded admin's
  `storageState` (OIDC `_session`/`_interaction` cookies **and** the lionel
  client's localStorage tokens; the production build uses
  `tokenStorage: 'local'`), and replay it onto a page's context.
- **`packages/api/tests/e2e/global-setup.ts`** — after the stack is up, log the
  admin in once and save the state. Best-effort: a missing state falls back to
  the real flow.
- **`packages/api/tests/e2e/setup.ts`** — `login()` replays the saved state when
  present, otherwise the full flow runs.
- **`packages/api/tests/e2e/browser-args.ts`** (new) — the chromium flags shared
  by the projects and the global-setup capture (the capture must resolve
  `slimfact.localhost` too).
- **`packages/api/playwright.config.ts`** — use the shared args; gate
  `screenshots-*.spec.ts` behind `PLAYWRIGHT_ALLOW_SCREENSHOTS` (CI never runs
  them).
- **`.gitignore`** — ignore `packages/api/tests/e2e/.auth/`.

## Measurements (host ran the test stack; per-test, `nosetup` config)

| | before | after |
|---|---|---|
| `login()` | 1315ms | **238ms** (replay) |
| minimal test (login + navigate) | 1.8s | **0.78s** |

Full suite (fresh-ish stack, workers=1): progressed at ~3s/test with no
`networkidle` hangs; the earlier "stuck" run spent **120s per test** waiting on
`networkidle` because the replayed session had been invalidated.

## Pitfalls found

- **The capture must happen after the stack is up.** A capture taken before a
  `docker compose down --volumes` is invalid: recreating the DB wipes the OIDC
  session, the API answers 401, and the app redirect-loop bounces between
  `/user` and the target route so `networkidle` never settles (the exact
  "stuck suite" symptom).
- **Access tokens live ~1h** (oidc-provider default; Grant/Session are 90d), so
  a normal suite run is covered. A stack recreated mid-run needs a re-capture.
- Replaying lands on `/user` — the URL the real flow ends on — and waits for
  `.q-drawer` to attach, so layout probes see a built shell.

## Not done

- The 54 `waitForTimeout` calls across the specs (payments-stripe 27,
  payments-mollie 21, invoice-flow 20, invoices-date-filter 14) are still
  fixed waits; converting the safe ones to condition waits is follow-up work.
- `workers` stays 1 — the suite shares one stack and has in-file serial groups.
