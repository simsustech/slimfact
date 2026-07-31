---
"@slimfact/api": patch
"@slimfact/app": patch
"@slimfact/tools": patch
---

Replace the `/admin` landing page with a real dashboard. The new admin landing page includes revenue cards (invoice + bill totals), a revenue bar chart (vue-chartjs), a status overview doughnut chart, action items for open invoices and 4 overdue buckets (needsReminder / reminder1 / reminder2 / exhortation), a recent activity timeline with type filter, and a multi-company filter. New tRPC routes (`admin.getDashboardStats`, `admin.getDashboardActivity`) feed the page, backed by 5 new methods on `@modular-api/fastify-checkout`'s invoice handler (`getInvoiceStatusCounts`, `getInvoiceOverdueAging`, `getPaidRevenue`, `getOutstandingTotal`, `getActivityFeed`). Date range supports Today / Week / Month / Quarter / Year presets plus a custom picker. The existing `DashboardAdminMenuList` is preserved as a card inside the new dashboard. Adds `vue-chartjs@^5.3.4` and `chart.js@^4.5.1` as dependencies.
