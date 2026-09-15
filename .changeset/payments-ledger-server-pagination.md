---
"@slimfact/app": patch
---

Payments page: page through the whole ledger instead of only the first 50
rows. The table fetched a single 50-row page and paginated client-side, so
"1–50 of 50" appeared even when hundreds of payments matched the filters.
The ledger table now runs in q-table server mode (@request): page requests
translate into the tRPC limit/offset, the footer shows the server-reported
total ("1–50 of 1,125"), and filter changes reset to page 1. The server owns
the sort (newest first), so the date column is no longer client-sortable.
