---
"@slimfact/app": patch
---

Payments page: render the ledger and suggestions date columns with
formatDate in the configured DATE_FORMAT (DD-MM-YYYY) instead of raw ISO
timestamps. Ledger dates arrive as full ISO timestamps, so the date part
is sliced before token formatting; the UTC date is used to stay aligned
with the server-side date filters.
