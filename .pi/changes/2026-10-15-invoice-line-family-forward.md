# Changes: forward `replaceTypedLines` on admin.updateInvoice, and land the 0.12 pins (2026-10-15)

Lands the three `slimfact` edits the 2026-10 cancelation handoff listed as blocked by the sandbox
(`~/Projects/petboarding-clients/HANDOFF.md` §3), the dependency refresh they were waiting on, and
the app-side half of a regression that refresh turned out to carry.

`@modular-api/fastify-checkout` replaced `replaceExistingLinesOfSameType: true` with
`replaceTypedLines`, a family-wide replacement. `admin.updateInvoice` did not declare the new key, so
zod **stripped it** and the merge fell back to its default — "the payload becomes the invoice's
lines" — which silently **deleted every manually added invoice line** on each sync. Petboarding sends
the key on every booking-invoice sync, so any invoice with a hand-added line lost it. Verified end to
end: with the forward reverted, the petboarding spec sees the invoice collapse to the cancelation
line alone.

## New files

| File | Description |
| --- | --- |
| `.changeset/invoice-line-family-replacement.md` | Minor changeset for `@slimfact/api`: the input change, the breaking note for the removed key, and the dependency-bump ordering. |

## Modified files (all hunks accepted)

| File | Lines | Description |
| --- | --- | --- |
| `packages/api/src/zod/invoice.ts` | +12/−1 | Declare `replaceTypedLines` (`string \| string[] \| null`, optional) on `invoiceValidation`, with the comment explaining why a stripped key is dangerous. |
| `packages/api/src/trpc/admin/invoices.ts` | +1/−2 | Forward `input.replaceTypedLines` to the checkout's `updateInvoice` instead of the removed flag. |
| `packages/api/tests/e2e/invoice-line-types.spec.ts` | +79/−8 | Rewrite the flag test to the new contract: the owned family is rewritten (the service line the payload stops sending is gone, no duplicate), a manual line and a *foreign* family survive; a second test pins the no-matcher default. |
| `packages/app/index.html` | −2 | The comment documenting the empty-title workaround is gone — it was the trigger for the vitrify 0.28.3 regression below. |
| `packages/api/package.json` | 12 ± | Pins refreshed (see the table below). |
| `packages/app/package.json` | 10 ± | Pins refreshed. |
| `packages/banking-api/package.json` | 2 ± | `@modular-api/event-bus` 0.2.3 → 0.2.4. |
| `packages/tools/package.json` | 2 ± | `@modular-api/fastify-checkout` 0.11.2 → 0.12.0. |
| `pnpm-workspace.yaml` | 18 ± (9 entries extended) | The new versions added to `minimumReleaseAgeExclude`. Every entry is *extended*, never replaced, so no existing exemption is lost. |
| `pnpm-lock.yaml` | +156/−226 | Regenerated against the new pins; `pnpm install --frozen-lockfile` passes the supply-chain gate. |
| `.pi/changes/2026-10-15-invoice-line-family-forward.md` | this file | The recap, updated from "not done" to the landed state. |

## The dependency refresh

| Package | From | To | Why |
| --- | --- | --- | --- |
| `@modular-api/fastify-checkout` | 0.11.2 | **0.12.0** | Carries `replaceTypedLines`; the fix is inert without it. |
| `@modular-api/api` | 0.6.41 | 0.6.42 | Same release train. |
| `@modular-api/fastify-oidc` | 0.9.30 | 0.9.31 | Same release train. |
| `@modular-api/event-bus` | 0.2.3 | 0.2.4 | Same release train. |
| `@modular-api/quasar-components` | 0.3.44 | 0.3.45 | Same release train. |
| `unocss-preset-quasar` | 0.7.2 | 0.7.3 | Refresh (MD3 role classes safelisted). |
| `vitrify` | 0.28.2 | 0.28.3 | Refresh — and the cause of the regression below. |

All of them were published inside the 24 h `minimumReleaseAge` window, so each needed an
`minimumReleaseAgeExclude` entry. The bump also pulled `@modular-api/fastify-cart@0.3.24` and
`@modular-api/oidc-interactions@0.7.27` in transitively; those two were exempted as well, or
`--frozen-lockfile` would fail the policy.

## The vitrify 0.28.3 regression (found by this verification, fixed upstream)

The first spec run against this tree failed both tests with a **blank white page**. The served HTML
had an *unterminated* comment:

```text
        <!-- One title, owned by the route map: the app sets document.title from
         `route.meta.lang`. An empty   <script type="module" src="/index.mjs"></script>
```

so the module script, the stylesheets and the modulepreloads were all inside the comment: no JS ran.

- Cause: 0.28.3 added the drop of the document's own title in `injectSsrContext`
  (`html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '')`). 0.28.2 has **zero** occurrences of that
  code. The matcher is not comment-aware, so it matched the `<title>` written inside the new
  template's comment and the lazy match ran on to the real `</title>` — taking the comment's
  terminator with it. Matched text, exactly:
  `"<title> here duplicated it in the SSR head. -->\n  <title>SlimFact</title>"`.
- Fixed upstream in `~/Projects/vitrify` (`master`, commit `1d781779`): comments are consumed first
  and handed back untouched, so only a real `<title>` is dropped. A regression test reproduces the
  broken head against the old matcher and passes with the new one.
- Mitigated here by deleting the comment (the app no longer has a `<title>` anywhere in its template),
  which is what lets this commit stand on **published** packages. The upstream fix needs no pin bump
  for correctness here; it will arrive with vitrify 0.28.4.
- petboarding is unaffected: it pins vitrify 0.28.2 and its template has a real `<title></title>`,
  not a commented one.

## Verification

- `pnpm exec tsc --noEmit -p packages/api/tsconfig.json` → **clean** (before the bump it reported
  `'replaceTypedLines' does not exist in type 'RawNewInvoice'`).
- `pnpm install --frozen-lockfile` → exit 0, lockfile in sync, supply-chain policy passes.
- `pnpm exec playwright test tests/e2e/invoice-line-types.spec.ts` → **2/2 pass**, on a stack built
  from the **published** packages only (no `LINKED_*` overlay), i.e. vitrify 0.28.3 and
  `@modular-api/fastify-checkout` 0.12.0 as consumers get them.
- With the fix and the pins in place but my local vitrify linked
  (`LINKED_VITRIFY_PATH=~/Projects/vitrify/packages/vitrify`), the same spec was also 2/2 — that is
  the run that proves the upstream fix, since it carried the comment that provoked the bug.
- Earlier baseline, unchanged by this work: full suite 79 passed / 9 skipped / 5 failed (the 5 are
  pre-existing order sensitivity, 13/13 in isolation); unit suites api 22/22 files, banking-api 15/15.

## Still open

- **Publish vitrify 0.28.4** — the fix is committed on `master` but unpushed, and a publish cannot be
  done from this sandbox (no npmjs token; `release.yaml` publishes through CI on a `master` push).
  After it ships, bump the `vitrify` pin here and in petboarding, and drop the corresponding
  `minimumReleaseAgeExclude` additions when they age out.
- Left deliberately untouched: the unrelated 4-line mangling in `AGENTS.md` (discarded from this
  commit at Stefan's direction) and the untracked `.pi/handoffs/`, `docker-compose.test.nl.yaml`,
  `cancelationCosts.spec.ts` and `slimfact-integration.ts` that belong to the petboarding session.
