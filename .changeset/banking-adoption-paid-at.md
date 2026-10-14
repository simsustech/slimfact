---
'@slimfact/api': patch
---

Book a missing `paid_at` when a bank credit is adopted.

Adoption only wrote `transaction_reference`, so a payment recorded before the
bank-transfer handler started writing `paidAt` kept a NULL date forever — and
the dashboard analytics read a NULL `paid_at` as "not revenue", so those
payments never showed up in the revenue chart, the payment-method split or the
activity feed.

Adoption now books the bank's posting date on the adopted row, exactly as the
create path already does, guarded by `coalesce` so a date the row already
carries is never overwritten.
