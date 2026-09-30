# Frontend audit suite

Instruments that answer questions the app's behavioural specs cannot: what does
every route _look_ like and _announce_, in both colour schemes, at both
viewports. It reads the accessibility tree shape, computed styles, emitted
design tokens and hit-testing — never app internals (the single exception is
`$q.screen`, which is the value the preset owns).

This is the harness behind the 2026-09-29 visual audit
(`~/.pi/plans/2026-09-29-slimfact-visual-audit.md`): the findings in that plan
are its output.

## Pre-flight

The linked worktrees must be part of the image build, or the audit measures
published packages instead of the code under test:

```bash
cd ~/Projects/slimfact
export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN)
export LINKED_QUASAR_COMPONENTS_PATH=$HOME/Projects/quasar-components/packages/components
export LINKED_UNOCSS_PRESET_QUASAR_PATH=$HOME/Projects/unocss-preset-quasar/.worktrees/rules/packages/preset
# petboarding's dev stack owns 80/443 on the shared `web` network, and
# global-setup.ts runs `up -d --wait` with no service list — so this stack's own
# caddy would try to bind them:
export TEST_CADDY_HTTP_PORT=8080 TEST_CADDY_HTTPS_PORT=8443
```

Verify the link took, the way the audit did — the served stylesheet must carry
the worktree's tokens:

```bash
curl -sk https://slimfact.localhost/ | grep -o -- '--q-comp-md: *[0-9]*px' | head -1
```

## Running it

```bash
cd ~/Projects/slimfact/packages/api
pnpm exec playwright test tests/e2e/frontend/screenshots-audit.spec.ts \
  --config=playwright-no-global.config.ts
```

**Why that config.** `playwright.config.ts` ignores `screenshots-*.spec.ts` — and
`testIgnore` filters _explicit_ file arguments too, so
`playwright test tests/e2e/frontend/screenshots-audit.spec.ts` under the default
config collects **0 tests** (measured). The repo's own
`screenshots-{admin,customer}.spec.ts` have the same property and are driven the
same way (`.pi/plans/dashboard.md` uses `--config=playwright.nosetup.config.ts`).
The trade-off is that a no-global config does **not** run
`tests/e2e/global-setup.ts`, so the stack must already be up:

```bash
# either run the normal suite once (its global-setup builds and starts the stack)
pnpm run test:e2e -- tests/e2e/account.spec.ts
# or bring it up directly
cd ~/Projects/slimfact && docker compose -f docker-compose.test.yaml up -d --wait --no-build
```

The stack stays up after a run, so the audit can follow a normal `test:e2e` pass
against exactly the images that pass built.

## What it covers

36 renderable routes (4 public · 25 administrator · 7 client-linked), each
captured at desktop 1440×900 and mobile 375×812 in light and dark — 144
captures per full run. The route table lives in `audit-helpers.ts`; keep it in
`routes.ts` order when adding a route.

The client group needs a roleless account linked to a client
(`customer@slimfact.app`). That account is seeded by
`packages/api/src/kysely/seeds/test.ts`; if it is missing — a database seeded
before it was added — the group is skipped and logged rather than failing the
sweep, so a run never reports a green sweep that silently covered 29 routes.

## Artefacts

`test-results/frontend-audit/<scheme>/<viewport>/<slug>.png`.

**Playwright wipes its output dir at the start of every run**, and these captures
live inside it: read them (or copy them out) before running any other Playwright
command. Never pass `--output=` to a Playwright command while captures matter —
it moves the wipe to the directory you name.
