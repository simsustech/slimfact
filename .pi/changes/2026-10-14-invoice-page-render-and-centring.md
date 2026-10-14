# 2026-10-14 — Invoice page: blank Typst render, and an uncentred header

Two independent regressions on the public invoice page (`/invoice/:uuid`), reported
together: "InvoicePage doesnt work anymore" with a Typst
`SourceDiagnostic: failed to load file (access denied)` / "cannot read file outside
of project root", and "the buttons and 'amount due' is no longer centered
horizontally".

## Root causes

### 1. Blank page — the template's import lines are an exact-string contract

`renderTypstInvoice` (`packages/tools/src/typst/index.ts`) injects `lang.typ` and
`internal.typ` into `templates/invoice/default.typ` by **exact string replacement**
of the two `#import` lines. `ecb7dfbc` ("style(tools): wrap the invoice template's
internal import", a formatting-only change) rewrapped the internal import into a
parenthesised, one-name-per-line block, so the replacement stopped matching. The
browser's Typst world was then left with a relative `#import "./internal.typ"` it
cannot resolve, and `TypstInvoice.vue`'s `v-if="svg"` never became true → no
invoice, just the page header.

Evidence, in order:

1. A node/`NodeCompiler` harness running the same two `.replace()` calls against
   the real template printed `lang.typ injected: true`,
   `internal.typ injected: false`, and
   `error: file not found (searched at …/packages/api/internal.typ)` at
   `#import "./internal.typ": (`. This is the fast loop (~1s).
2. A browser run reproduced the reporter's message verbatim:
   `error: [SourceDiagnostic { severity: Error, span: Span(320625599769715),
   message: "failed to load file (access denied)", … hints: ["cannot read file
   outside of project root", …] }]`, with the page's own text missing from the
   accessibility tree.

The existing guard could not catch it: `packages/tools/tests/typst/totals-grid.test.sh`
compiles the template **from disk**, where `./internal.typ` does resolve, so it
passed throughout.

**oxfmt is not the cause of the rewrap.** `oxfmt --check templates/invoice/default.typ`
reports "All matched files may have been excluded by ignore rules", and the
package-wide check covers 27 files without it — oxfmt does not match `.typ` at all.
There is no prettier dependency and no typst formatter in the repo, so the wrap was a
hand/agent style edit. Adding an `ignorePatterns` entry for `*.typ` would have been
dead config, so none was added.

### 2. Uncentred header — the preset made `.row` layout-only

The header actions and the amount line are centred by `justify-center` on
`div.row` **inside `<q-toolbar>`**. `.q-toolbar` is `display:flex`, which makes that
row a shrink-to-fit flex item, so `justify-content:center` has no free space to
distribute. It only ever looked centred because `unocss-preset-quasar`'s `.row`
carried `flex: 1 1 auto`.

The preset removed that deliberately in `2e24c50` (2026-09-21, *".row/.column are
layout only, as Quasar's flex addon says"*) because the growth stretched
petboarding's drawer content column. SlimFact jumped **0.5.6 → 0.7.0** on 0.7.0's
release, so the invoice page inherited it; the committed baseline screenshot
(`packages/docs/public/screenshots/invoice-public.png`, preset 0.5.6) still shows the
centred layout. The preset is right and Quasar's own flex addon agrees — the
invoice markup was the thing relying on the bug.

## Changes

- `packages/tools/templates/invoice/default.typ` — restored the single-line
  `#import "./internal.typ": …`, and added a comment above both imports stating that
  they are replaced by exact string match and must stay on one line each.
- `packages/app/src/pages/InvoicePage.vue` — `full-width` on the four header
  `div.row.justify-center` blocks (the one under `<q-page-container>` already had a
  block-level parent and was left alone), and removed the leftover `#qrcode` div
  from the page header (see below).
- `packages/app/src/tools.ts` — deleted a **second, unused** `renderTypstInvoice`
  (plus its now-unused imports and `pageWidth`/`typstInitialized` state) that carried
  the same exact-string contract. Only `computeNumberPrefix` was imported from this
  module; `TypstInvoice.vue` imports the live renderer from `@slimfact/tools/typst`.
- `packages/api/tests/e2e/invoice-render.spec.ts` *(new)* — the regression test: an
  OPEN invoice through the admin UI, then the public page must render a Typst `svg`
  inside `.q-scrollarea` (containing the line description) with no Typst console
  error, and the header action group's centre must be within 15px of the viewport
  centre.
- `.changeset/invoice-page-render-and-centring.md` *(new)*.

## Verification

- `pnpm exec playwright test tests/e2e/invoice-render.spec.ts --workers=1` →
  **1 passed (3.1m)**, and red before the fix (the exact `SourceDiagnostic` above).
- Wider slice against the same stack (`E2E_OWN_STACK=0`), 8 spec files —
  `invoice-render`, `invoice-flow`, `invoice-create-search`, `invoice-line-types`,
  `icons`, `frontend/checkout`, `frontend/a11y-names`, `frontend/layout` →
  **22 passed (3.6m)**, 0 failed.
- `packages/tools`: `pnpm run test` → `PASS: all discounts/surcharges on separate rows`.
- `pnpm run lint` (no new findings), `pnpm run format:check` (all clean),
  `PI_RTK_BYPASS=1 pnpm run build`, and `packages/app` `tsc --noEmit` → clean.
- Centring measured against the baseline image rather than eyeballed
  (`magick … -trim -format '%[fx:page.x+w/2]'`): buttons **644** vs baseline
  **644.5**; amount line **663** vs baseline **662.5**. The amount line sits 23px
  right of the viewport centre because `<q-toolbar inset>` carries
  `padding-left: 58px` — that is the baseline's own geometry, so `inset` was left
  alone.

## Traps recorded

- The `.typ` imports are load-bearing in their **exact single-line form**; the
  `.typ` file now says so, and the E2E spec is the enforcement.
- `unocss-preset-quasar` `.row` no longer grows (0.6.0+): a `justify-center` row
  inside any flex parent needs an explicit width (`full-width`).
- Qtoolbar geometry: `.q-toolbar--inset` adds `padding-left: 58px`, so centred
  content inside it lands ~23px right of the viewport centre — expected, not a bug.

## The header QR div (removed)

The page header carried a second `#qrcode` div (`id="qrcode"` also existed in the
bank-transfer dialog). It was dead markup: `uqr`'s `renderSVG` emits only a
`viewBox` — no intrinsic size — so with `max-width: 5cm` alone and the div being a
shrink-to-fit flex item of `.q-toolbar`, the SVG resolved to **zero width**
(measured `w: 0, h: 48`) and never appeared. The dialog's own QR is unaffected and
furthest from that trap: it sits in a block container, where the 5cm cap gives the
SVG a definite width (measured 189x189, as its markup intends).

An earlier attempt here "fixed" the QR by giving it an explicit 5cm box in a shared
class — which correctly sized the dialog's QR but also made the header's dead div
**visible**, i.e. an unwanted QR next to the Pay button. The right call is the one
taken: the QR lives in the dialog only, so the header div is gone and the dialog's
markup is unchanged. The E2E spec asserts the dialog's own QR still renders at its
5cm box.
