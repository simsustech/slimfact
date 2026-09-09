---
"@slimfact/app": patch
---

Payments page (PaymentsPage): move the ledger filters (date range, method,
status, PSP, source) into a QMenu opened by a Filters button; default the
fresh (unfiltered) view to payments from the first day of the current year
with status "paid"; and render a localized summary sentence of the active
filters (e.g. "Payments from 01-01-2026 with status 'paid'"). Deep links that
pass explicit filter params keep their exact semantics.
