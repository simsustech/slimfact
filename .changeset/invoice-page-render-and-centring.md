---
'@slimfact/app': patch
'@slimfact/tools': patch
---

Render the public invoice page again, and centre its header.

Two independent regressions on `/invoice/:uuid`:

- **The page rendered nothing.** `renderTypstInvoice` injects the `lang.typ` and
  `internal.typ` modules into `templates/invoice/default.typ` by exact string
  match of the two `#import` lines. Reformatting the internal import into a
  parenthesised, one-name-per-line block stopped that replacement from matching,
  which left the browser's Typst world with an unresolvable
  `#import "./internal.typ"` — `SourceDiagnostic: failed to load file (access
  denied)`, and an empty page. The single-line import is restored, and the line
  now warns that it is load-bearing.
  so these rows now carry an explicit `full-width`.
- **The header also dropped a leftover QR div.** The bank-transfer QR belongs to
  its dialog; the header's second copy was dead markup that never rendered (its
  SVG has no intrinsic size and collapses inside the toolbar row).

`tests/e2e/invoice-render.spec.ts` guards both: it fails if the invoice does not
render, if the header actions are not centred, or if the dialog's QR stops
rendering at its 5cm box.
