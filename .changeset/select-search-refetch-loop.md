---
'@slimfact/app': patch
---

Stop the company/client search selects from refetching in a loop.

`onFilterCompanies`/`onFilterClients` set the search phrase and then called
`activate()`, which unconditionally `refetch()`ed. Quasar emits a synthetic
`filter('')` whenever a select's options identity changes while its menu is
open, so each synthetic event refetched, changed the options, and produced
another synthetic event — an unbounded request loop that overwrote the result
the user was typing for (the report: the company and client selects "are not
searchable").

`activate()` is now idempotent: the first call (dialog open) fetches, and after
that the query's reactive `key` — the search phrase — drives every fetch. An
unchanged phrase no longer triggers one, which breaks the loop. This matches
the retail-style connection-to-the-key pattern; the query stays lazy, so these
lists still stay out of the page-mount batch.
