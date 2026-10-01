---
"@slimfact/api": patch
"@slimfact/app": patch
"@slimfact/tools": patch
---

Fix multiple discounts rendering concatenated on a single line in the Typst
invoice template's totals grid (same fix applies to surcharges and tax-summary
entries).

The `for` loops in the totals grid were passed to `grid(...)` un-spread, so
each loop joined all of its iterations into one value — a single grid cell.
Two or more discounts rendered as `Cheap:Expensive: − € 5.00− € 2.50` on one
line. Each loop body now yields a `(description, price)` pair array spread
with `..`, so every entry gets its own row, matching the pattern the lines
table already used.

Regression test: `packages/tools/tests/typst/totals-grid.test.sh`, runnable
via `pnpm run test` in `packages/tools` (requires `typst` and `pdftotext`).
