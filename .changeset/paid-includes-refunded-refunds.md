---
"@slimfact/app": patch
---

Payments page: treat status "paid" as including settled refunds. A refund's
terminal status is "refunded" (not "paid"), so the ledger status filter
silently hid every refund whenever "paid" was selected. Selecting "paid" now
also returns refunded refunds — the money-out side of a paid payment. Other
status selections stay payment-only. Implemented server-side in the shared
ledger query, so the CSV export matches the on-screen view.
