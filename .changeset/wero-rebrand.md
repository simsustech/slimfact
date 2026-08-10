---
"@slimfact/api": patch
"@slimfact/app": patch
"@slimfact/tools": patch
---

Rebrand iDEAL to Wero across the app and API. The product-level payment method is now `wero` (label "Wero | iDEAL", `arcticons:wero` icon) while the PSP-level method stays `ideal` (Wero rides on iDEAL rails) via translation in `@modular-api/fastify-checkout`. Shift test-stack Docker ports (db 5433, mailhog 1027/8027) to avoid clashing with the petboarding dev stack. Fix a flaky `mkBill` e2e helper that waited on Quasar expansion-item content visibility; it now waits for the invoice "Open" link to appear instead.
