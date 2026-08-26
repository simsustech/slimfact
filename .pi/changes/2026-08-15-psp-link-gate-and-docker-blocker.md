# 2026-08-15 — PSP payout reconciliation + unified bank linking: gate status + Docker blocker

## Why

Session resumed after a crash mid-implementation of
`.pi/plans/2026-08-14-bank-link-psp-icons.md` (PSP payout reconciliation,
unified bank linking with single/multi/split/psp link proposals, i-mdi icon
audit). The crash left the full-suite E2E gate (plan step 14) with 2 failures
at 23:58: `banking-proxy` strict-match and `invoice-flow` CONCEPT→CANCELED.

## What changed this session

- **Diagnosed the crash-era failures**: `banking-proxy`'s
  `bank:seed-credit-004 vs 007` mismatch was a mid-edit seed state — the
  current seed is consistent (004 on rabobank/Active → strict-matches invoice
  C; 007 on knab/RequiresReauth → worker skips, "Invoice C stays free for the
  worker demo" comment in the seed). `invoice-flow` CONCEPT→CANCELED already
  had its fix applied pre-crash (dialog-scoped OK click); verified passing.
- **Hardened 3 E2E specs against cross-file parallelism races** (the suite
  runs `fullyParallel`):
  - `payments.spec.ts` (cash payment): no longer assumes the just-created
    invoice is the first row — targets the row by its `E2E` line description
    (parallel specs leave CONCEPT invoices on top; first-row menu lacks
    "Add payment"). Removed the now-unused `clickMoreButton` import.
  - `banking-company-filter.spec.ts`: the Linked/Unlinked partition assertions
    used seed-credit-002 (linked mid-run by `banking-link`) — switched to
    seed-credit-005 (never linked; split demo only opens its dialog) and to
    the unique counterparty `E2E Client` for 001's Linked chip (006 also
    amounts to +42.00 and gets reconciled by the parallel psp test). Fixed a
    stale row-attribution comment.
  - `banking-link.spec.ts`: same `E2E Client` targeting for 001's chip; fixed
    stale multi-test title ("pays invoices C and D" → "D and F").
- **Verified the E2E gate**: run 1 on a fresh stack: **26 passed / 8 skipped /
  1 failed** — the only failure was the payments.spec cash flake (pre-existing,
  now hardened). Run 2 on the _same_ stack was invalid (banking specs mutate
  the seeded world; re-runs require reseed) — the 3 failures were all
  dirty-state, 2 of them covered by the hardening above.

## Docker daemon corruption (blocker)

The host Docker daemon's containerd overlayfs snapshot store is corrupted
(layer dirs like `snapshots/12509/fs` missing). Symptoms: dead containers
stuck "removing" forever, `compose down` stalls, image builds fail with
"failed to stat parent ... no such file or directory", even freshly pulled
base images can't mount. In-sandbox repairs all failed (builder/system prune,
re-pull bases, `--no-cache`, force-recreate, workaround projects
`open-banking2`/`open-banking3`). The sandbox blocks `sudo`/systemctl
(no-new-privileges), so a host-side fix is required:

```bash
sudo systemctl restart docker
docker system prune -af   # clears stuck removals + corrupt images
```

## Files changed

- `packages/api/tests/e2e/payments.spec.ts` — cash test row scoping
- `packages/api/tests/e2e/banking-company-filter.spec.ts` — stable-row assertions
- `packages/api/tests/e2e/banking-link.spec.ts` — chip row targeting + title

## Verification

- Unit `pnpm test`: **88 passed / 25 skipped / 0 failed** (DB at localhost:5433)
- `pnpm run lint`: warnings only (pre-existing, none from this work)
- `pnpm run format:check`: clean (fixed payments.spec via `oxfmt --write`)
- `PI_RTK_BYPASS=1 pnpm run build`: exit 0
- E2E: fresh-stack run green for all banking specs (26 passed); final full-suite
  re-run **blocked by the Docker daemon** — needs the host restart above, then
  the standard fresh-stack recipe (note: `LINKED_MODULAR_API_EVENT_BUS_PATH`
  must be exported before `docker compose build`).

## State left behind

- Workaround stack `open-banking3` running: database (localhost:5433, full
  E2E seed: migrate + seed:test + seed:fake), banking-api, caddy, mailhog.
  The api image is corrupt — recreate it after the daemon restart.
- Stuck dead containers from `open-banking` (original) and `open-banking2`
  projects — clean with `docker system prune -af` after restart.
