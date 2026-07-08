# Changes: Pagination for invoice/bill/receipt lists (2026-06-23)

## Modified files
| File | Lines | Description |
|------|-------|-------------|
| `packages/api/src/trpc/user/invoices.ts` | ~40 | Added `paginationSchema` (Zod) with limit/offset/sortBy/descending. Threaded optional `pagination` param through `getInvoices`, `getBills`, `getReceipts` tRPC procedures. |
| `packages/app/src/queries/account/bills.ts` | ~20 | Added reactive `page`/`rowsPerPage` refs + `pagination` computed. Query key includes pagination for reactivity. Returns `page`, `rowsPerPage` alongside data. |
| `packages/app/src/queries/account/invoices.ts` | ~20 | Same as bills.ts |
| `packages/app/src/queries/account/receipts.ts` | ~20 | Same as bills.ts |
| `packages/app/src/pages/account/BillsPage.vue` | ~25 | Added `<q-pagination>` component, `page`/`rowsPerPage`/`total` computed, `useLang()` import, empty-state `<q-item>`. |
| `packages/app/src/pages/account/InvoicesPage.vue` | ~25 | Same as account BillsPage |
| `packages/app/src/pages/account/ReceiptsPage.vue` | ~25 | Same as account BillsPage |
| `packages/app/src/pages/admin/BillsPage/BillsPage.vue` | +5 | Added empty-state `<q-item>` for no results. |
| `packages/app/src/pages/admin/ClientsPage/ClientsPage.vue` | +9 | Added empty-state `<q-item>` for no results. |
| `packages/app/src/pages/admin/InvoicesPage/InvoicesPage.vue` | +8 | Added empty-state `<q-item>` for no results. |
| `packages/app/src/pages/admin/ReceiptsPage.vue` | +11 | Added empty-state `<q-item>` + `useLang()` import + `lang` ref. |
| `packages/app/src/pages/admin/SubscriptionsPage/SubscriptionsPage.vue` | +8 | Added empty-state `<q-item>` for no results. |
| `packages/app/src/pages/admin/settings/CompaniesPage/CompaniesPage.vue` | +12 | Added empty-state `<div>` + `useLang()` import + `lang` ref. |

## Notes
- Pagination is offset-based with 5 items per page default, sorting by `id` descending
- `total` is derived from `data?.at(0)?.total` (returned by the invoice handler)
- `<q-pagination>` uses `max-pages="5"` and `direction-links` for nav
- Empty states use `lang.noResultsAvailable` for i18n
