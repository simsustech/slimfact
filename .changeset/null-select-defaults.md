---
"@slimfact/app": patch
---

Stop the company and client filter selects from rendering "NaN".

The filter state for invoices, bills, receipts and subscriptions used `NaN` as
its "unset" sentinel — the query composables initialised `companyId`/`clientId`
as `ref(NaN)` and the list pages wrote `NaN` back on clear and on "search by
client name". A Quasar `QSelect` with `map-options` renders a model that matches
no option verbatim, so an empty filter displayed `NaN` in the input, and the
`!Number.isNaN(...)` presence checks in the receipts and subscriptions pages made
the "clear search" icon look active with no filter set.

The models are now `number | null` and `null` is the unset value everywhere
(`invoices.ts`, `bills.ts`, `receipts.ts`, `subscriptions.ts`). The api was
already prepared for it: `getInvoices` and `getSubscriptions` declare
`companyId`/`clientId` as `z.number().nullable().optional()`.

`packages/app/tests/unit/noNanSelectState.test.ts` fails if a `NaN` sentinel
returns to filter state, and `invoices-date-filter.spec.ts` asserts the filter
selects in the running app are empty rather than `NaN`.
