# 2026-10-13 — E2E: replace fixed waits with condition waits

## Why

The last petboarding improvement left over: fixed `waitForTimeout` sleeps.
The suite had 57 in specs; the non-PSP ones are all cheap to make conditional.

## What

| File | Before | After |
| --- | --- | --- |
| `invoice-create-search.spec.ts` | 2× `waitForTimeout(1800)` dialog settle, 250 ms retry, 150 ms menu close | wait on the dialog's own animations (`getAnimations().finished`); wait for the listbox to hide |
| `helpers.ts` `fillComboboxes` | `waitForTimeout(1800)` dialog settle, 250 ms retry | same two conditions (shared by every `mkInvoice` spec) |
| `dashboard.spec.ts` | `waitForTimeout(150)` per chip removal | `expect(removeButtons).toHaveCount(before - 1)` |
| `layout.spec.ts` | `waitForTimeout(1500)` after the locale switch | wait for the rail's Account label to read `expectedAccount` (the German guard) |
| `palette.spec.ts` | `waitForTimeout(500)` after `setDark` | dropped — `setDark` already waits for `body--dark` |

Spec `waitForTimeout` count: **57 → 50**. The remaining 50 are the PSP specs
(`payments-stripe` 27, `payments-mollie` 20, refund-settled 1 — genuinely
timing-dependent around the PSP redirect), one in a `test.skip`-ed banking spec,
and one route-settle in the palette audit with no clear condition.

## Verification (running stack, `E2E_OWN_STACK=0`)

- `invoice-create-search.spec.ts` → **5 passed** twice (17–20 s, was ~30 s).
- `dashboard.spec.ts -g empty-state` → 1 passed.
- `frontend/layout.spec.ts` → 1 passed.
- `frontend/palette.spec.ts` → 2 passed.
- `invoice-flow.spec.ts -g "CONCEPT|manual bank-transfer|deleting an offline|bill with clientDetails"` → **6 passed** (the `fillComboboxes` path).
- `pnpm run format:check` / `pnpm run lint` clean.
