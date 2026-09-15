---
"@slimfact/app": patch
---

Payments page: add company and client filters to the ledger filter menu.
The ledger now joins through the payment's invoice, so payments can be
narrowed to a company or client (both also apply to the CSV export). The
filter state round-trips through the URL (companyId/clientId params), and
explicit deep links bypass the fresh-view defaults like the other filter
params.
