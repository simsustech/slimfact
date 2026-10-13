# 2026-10-13 — Company/client selects were not searchable (refetch loop)

## Symptom

In the invoice/bill/subscription create dialogs, typing into the Company or
Client select did not filter the list. `tests/e2e/invoice-create-search.spec.ts`
test 2 failed with `Acme Inc` still present after typing `retail` — the single
real `searchCompanies?input="retail"` request was buried under a flood of
`searchCompanies?input=""` requests (~120/s; 675 empty requests in one run).

## Root cause (two halves, one loop)

1. **Quasar's synthetic empty filter.** With `use-input` on, `QSelect` has
   `watch(innerValue)` that calls `filter('')` whenever the options array
   *identity* changes while the menu is open and nothing is selected. Our
   parent replaces `filteredOptions` on every fetch, so the options identity
   changes on every fetch → another synthetic `filter('')`.
2. **`FilteredModelSelect` forwarded that empty value as the search phrase.**
   So the phrase the user typed was replaced by `''`.
3. **The app refetched on every filter event.** `onFilterCompanies` /
   `onFilterClients` did `searchPhrase.value = …; activate()` where `activate()`
   was an unconditional `refetch()`. Each synthetic `''` therefore fetched,
   which changed the options, which produced another synthetic `''` — an
   unbounded loop, with the typed result always overwritten by the last empty
   one.

Note: `FilteredModelSelect` calling `update(() => {})` **synchronously** (the
mobile-Chrome fix carried over from petboarding) clears Quasar's
`innerLoading` guard and is what lets the synthetic filter through. The
synchronous open is still wanted; the loop had to be broken elsewhere.

## Fix

- `@simsustech/quasar-components` — `packages/components/src/ui/form/FilteredModelSelect.vue`
  (linked locally; **needs a release + dependency bump** for production):
  track QSelect's `input-value` and, when a `filter` event arrives with `''`,
  report the input's real text instead. A made selection clears the tracked
  text, so QSelect's prefetch of an unmapped model value asks for the full list
  rather than searching for the option label.
- `@slimfact/app` — `packages/app/src/queries/admin/companies.ts`,
  `clients.ts`: make `activate()` idempotent. The first call (dialog open)
  fetches as before; afterwards the query's reactive `key` (the search phrase)
  drives every fetch, so an unchanged phrase no longer refetches. The lazy
  `active` gate is preserved.

## Verification

Test stack (Docker, `--allow=network.host` workaround needed under nono — the
test compose sets `build.network: "host"`):

- `invoice-create-search.spec.ts` tests 1–3 pass (`3 passed`): the list shows
  every company on open, and company **and** client accept typed search.
- Request volume after the fix: **16** `searchCompanies` calls across a whole
  spec run (all meaningful phrases) vs **678** before (675 empty).

## Pre-existing failures (NOT caused by this fix; reproduced on unmodified code)

- `invoice-create-search.spec.ts` test 4 (`create an invoice by searching…`)
  fails at the **Number prefix** select: it stays empty → `Field is required`.
  The plain `NumberPrefixSelect` is untouched by this fix and works in
  `fillComboboxes`-based specs; the failure reproduces on the reverted build.
- `invoice-create-search.spec.ts` test 5 (`stale search phrase`) assumes the
  first invoice is editable, but the seed's newest invoice (18) is
  Overdue/OPEN → immutable, so its More menu has no "Update".
- `invoice-flow.spec.ts` `BILL → RECEIPT (paid bill)` times out — also fails on
  the reverted build.

## Files

- `packages/components/src/ui/form/FilteredModelSelect.vue` (quasar-components)
- `packages/app/src/queries/admin/companies.ts`
- `packages/app/src/queries/admin/clients.ts`
- `.changeset/select-search-refetch-loop.md`
- `…/quasar-components/.changeset/filtered-model-select-keeps-typed-phrase.md`
