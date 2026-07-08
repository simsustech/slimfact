# Plan: Add "Rows Per Page" Select — Responsive Grid Layout

## Current State

8 pages with `q-pagination`. All use the same pattern:

```vue
<div class="flex flex-center q-mt-md">
  <q-pagination v-model="page" :max="Math.ceil(total / rowsPerPage)" ... />
</div>
```

`rowsPerPage` is already a reactive `ref(5)` exposed from each query composable — no backend or query composable changes needed.

## QTable Reference (Quasar source)

QTable uses a `row items-center` flex bottom bar:
1. **Left**: `q-table__control` — label + QSelect for rows-per-page
2. **Center**: `q-table__separator col` (flex-grow spacer)
3. **Right**: prev/next QBtn's (NOT QPagination — individual buttons)

```js
const bottomClass = 'q-table__bottom row items-center'
child.push(h('div', { class: 'q-table__separator col' }))
function onPagSelection(pag) {
  setPagination({ page: 1, rowsPerPage: pag.value })
}
```

Key: QTable uses simple QBtn prev/next, **not** QPagination.

## Existing Pattern in Codebase

Forms already use Unocss grid (Tailwind v4 compat via `unocss-preset-quasar`):

```vue
<div class="grid grid-cols-12 gap-3">
  <form-input class="md:col-span-3 col-span-12" ... />
  <form-input class="md:col-span-3 col-span-12" ... />
</div>
```

Available breakpoint: `md:` (768px).

## Proposed Layout

**On `md` and up** — side by side in a 12-column grid:
- **col 1-3**: `q-select` for rows-per-page
- **col 4-9**: `q-pagination` centered with `flex justify-center`
- **col 10-12**: empty

**Below `md` (mobile)** — stacked full-width rows.

```vue
<div class="grid grid-cols-12 items-center gap-3 q-mt-md">
  <div class="col-span-12 md:col-span-3">
    <q-select
      v-model="rowsPerPage"
      :options="[5, 10, 15, 25, 50]"
      :label="lang.rowsPerPage"
      dense
      outlined
    />
  </div>
  <div class="col-span-12 md:col-span-6 flex justify-center">
    <q-pagination
      v-model="page"
      :disable="!(total && page && rowsPerPage)"
      :max="Math.ceil(total / rowsPerPage)"
      :max-pages="5"
      direction-links
    />
  </div>
</div>
```

Plus a `watch` to reset page on rowsPerPage change:

```ts
watch(rowsPerPage, () => { page.value = 1 })
```

## Files to Change

### Language (4 files)
| File | Change |
|------|--------|
| `packages/app/src/lang/index.ts` | Add `rowsPerPage: string` to interface after `noResultsAvailable` |
| `packages/app/src/lang/en-US.ts` | Add `rowsPerPage: 'Rows per page'` |
| `packages/app/src/lang/nl.ts` | Add `rowsPerPage: 'Regels per pagina'` |
| `packages/app/src/lang/de.ts` | Add `rowsPerPage: 'Zeilen pro Seite'` |

### Page templates (8 files) — replace pagination div + add watch

| File | Has `watch`? | Needs import change? |
|------|-------------|---------------------|
| `packages/app/src/pages/admin/InvoicesPage/InvoicesPage.vue` | ✅ yes | No |
| `packages/app/src/pages/admin/BillsPage/BillsPage.vue` | ✅ yes | No |
| `packages/app/src/pages/admin/ReceiptsPage.vue` | ✅ yes | No |
| `packages/app/src/pages/admin/ClientsPage/ClientsPage.vue` | ❌ no | Add `watch` to vue import |
| `packages/app/src/pages/admin/SubscriptionsPage/SubscriptionsPage.vue` | ❌ no | Add `watch` to vue import |
| `packages/app/src/pages/account/InvoicesPage.vue` | ❌ no | Add `watch` to vue import |
| `packages/app/src/pages/account/BillsPage.vue` | ❌ no | Add `watch` to vue import |
| `packages/app/src/pages/account/ReceiptsPage.vue` | ❌ no | Add `watch` to vue import |

## Verification

1. **Visual**: pagination stays centered on md+, select appears at left, stacks on mobile
2. **Functional**: change rows-per-page → data refreshes, page resets to 1
3. **Build**: `pnpm run build` succeeds
4. **All 8 pages**: consistent pattern

## NOT YET IMPLEMENTED — await explicit approval

Shall I implement this?
