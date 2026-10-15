---
'@slimfact/api': minor
---

Forward `replaceTypedLines` on `admin.updateInvoice` instead of stripping it.

`@modular-api/fastify-checkout` replaced `replaceExistingLinesOfSameType: true`
with `replaceTypedLines` (one or more type fragments: every existing line whose
`type` contains one of them is dropped before the payload is appended). This
input object did not declare the new key, so zod **stripped it** and
`updateInvoice` fell back to its default — "the payload becomes the invoice's
lines" — which silently **deleted every manually added invoice line** on each
sync. The key is now declared and forwarded.

BREAKING for callers of the old key: `replaceExistingLinesOfSameType` is gone.
Pass `replaceTypedLines: '<prefix>'` — petboarding sends `'petboarding'` — or no
option at all for the previous `false` behaviour.

Release order: this only takes effect once the dependency is bumped to the
`@modular-api/fastify-checkout` version that carries `replaceTypedLines`
(0.12), which is a separate release step.
