---
"@slimfact/api": patch
"@slimfact/app": patch
"@slimfact/tools": patch
---

Add a start/end date-range filter to the admin invoice, bill and receipt
lists, filtering on the effective document date
(`COALESCE(date, created_at)` from `@modular-api/fastify-checkout@0.9.1`) so
undated documents (concept, bill, receipt, canceled) match via their
creation date. URL params (`startDate`/`endDate`) apply read-only on load and
route update; the filter menu gains two DateInputs. Shared helpers
`validIsoDate` and `dateQueryParam` were added to `@slimfact/tools`, and
`DATE_FORMAT` is now a single shared computed in `configuration.ts`.
