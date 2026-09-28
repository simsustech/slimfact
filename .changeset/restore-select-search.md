---
"@slimfact/app": patch
---

Restore typing-to-search in the company and client selects, and stop a stale
search phrase from shrinking the company list to one entry.

`CompanySelect` and `ClientSelect` declared `onFilter` in `defineProps`. A
declared prop intercepts the listener out of `$attrs`, so the parent's `@filter`
never fell through to `FilteredModelSelect`. Two symptoms followed from that one
broken link: `FilteredModelSelect` gates `use-input` on `!!onFilter`, so the
field rendered readonly and nothing could be typed; and its `filter` emit had no
listener, so the parent's handler — the thing that refreshes and resets
`searchPhrase` — never ran. The edit path sets `companiesSearchPhrase` to the
document's company name, and with no open-event to clear it, the next dialog's
company select showed only that one match (the "only 1 company on open" report).
The prop comment explicitly claimed the forward was unnecessary; it was the bug.

Both components now forward the listener with `@filter="onFilter"`, and the
comment documents why the forward is load-bearing.

New e2e spec `tests/e2e/invoice-create-search.spec.ts` covers the scenario:
the company select lists every company on open, company and client accept typed
search, an invoice is created by searching company and client, and a create
dialog opened after an edit still lists every company (red with `Received: 1`
on the broken code). The submit assertion requires the dialog to close — the
euro amount also renders inside the open dialog, which made a failed submit a
false green.
