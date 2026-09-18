# 2026-09-18 — the invoice form writes the link, and the api rejects a contradiction

## Why

Found while sweeping the `NaN` select sentinels: `InvoiceForm`'s `setValue` had
two symmetric branches, and the client one assigned to the wrong field —

```ts
if (newValue.clientId != null) modelValue.value.clientId = newValue.clientId;
else if (newValue.clientDetails.id && !Number.isNaN(newValue.clientDetails.id))
  modelValue.value.companyId = newValue.clientDetails.id; // ← company, not client
```

The rule, confirmed with the domain owner:

- `companyId`/`clientId` are the **link** between a document and the SlimFact
  company/client record;
- `companyDetails`/`clientDetails` are the invoicing **details** printed on the
  document — name, address, VAT number, … — and may carry no `id` at all;
- if a details object does carry an `id`, it equals the link.

So the fix is neither to resolve a link at read time nor to normalise one in the
form: **the contradicting pair must not be written.**

## Where the invariant lives

`createInvoice`/`updateInvoice` (`src/trpc/admin/invoices.ts`) take the stored key
_from_ the details:

```ts
companyId: companyDetails.id,
clientId: clientDetails.id
```

and rebuild `companyDetails`/`clientDetails` from the record whenever
`input.companyId`/`input.clientId` is supplied. So a details id submitted next to a
different key is stale input that the current code silently ignores (the rebuild
wins), and a details id submitted with no key _becomes_ the link.

What the app could still do is the reverse of a contradiction, and it is a real
defect: the form loaded a document's details _with_ their id, so clearing the
client select submitted `clientId: null` with `clientDetails.id = 5`, and the api
stored `client_id = 5`. Clearing the select could not unlink anything.

## What changed

- `packages/app/src/components/invoice/InvoiceForm.vue`: `setValue` binds only
  `companyId`/`clientId` (unconditionally, so a reset cannot keep a previous
  document's selection) and `submit` sends the details without their id.
- `packages/app/src/utils/invoice.ts`: `withoutDetailsId(invoice)` — drops
  `companyDetails.id`/`clientDetails.id`, keeps the keys and everything else, and
  leaves missing details missing. No read-time resolution remains to get wrong.
- `packages/api/src/zod/invoice.ts`: `detailsLinkMismatch(input)` returns a message
  when a details id **and** a link are both present and disagree. Both procedures
  throw `TRPCError({ code: 'BAD_REQUEST' })` with it. A missing half is deliberately
  not a contradiction: with no key the procedures take it from the details (that is
  how a details-only payload gets linked at all), and details without an id are the
  unlinked document.
- Tests: `packages/app/tests/unit/invoiceDetailsId.test.ts` (4) and
  `packages/api/tests/unit/invoiceDetailsLink.spec.ts` (6).
- `AGENTS.md` → **Key Data Models**: the rule and its two code consequences.
- `.changeset/invoice-form-client-selection.md` (app patch).

## Why the check is at the api boundary and not in the handler

The handler (`fastify-checkout`'s `createInvoice`/`updateInvoice`) is the single
place every writer funnels through, so it is the obvious home for the check — but
it also consumes the queued `subscription:*` jobs (`pgboss.ts`'s
`subscriptionWorker` calls `createInvoice(singleJob.data)`), and those payloads are
built and queued elsewhere (the linked package schedules them). A throw there would
turn a stale subscription payload into a failing background job, i.e. invoices that
silently stop being generated. The interactive api boundary keeps the check where a
contradiction can only mean stale input from a caller, and where the caller sees the
error.

## Corrections to what I said earlier in this session

- I claimed a UI-created document's details carry no id, and used that to argue the
  `clientDetails.id` fallback was dead code. **Wrong**: the api builds the details
  from the client record _including_ `clients.id`, so a linked document's details do
  carry the id. The branch was reachable — and so was the e2e I wrote and deleted:
  nulling `client_id` in the DB leaves `client_details.id` set, so that assertion
  would have distinguished the fix. It stays deleted for the domain reason: that row
  state (`client_id = NULL` with `client_details.id` set) is the contradiction the
  rule forbids, and testing behaviour for it would have blessed it.
- I introduced the word "snapshot" for the details objects. It is not in the domain
  vocabulary and it overstates the semantics (the fields are editable in the form,
  and the api re-copies them from the record on save), so everything now says "the
  link" and "the invoicing details".
- The earlier `NaN`-vs-`null` question for the _filter_ state is still open with the
  user: `null` and `NaN` coerce differently under `Number()` (0 vs NaN), though no
  site in the app or api coerces these models.

## Verified

- `pnpm test` (`vitrify test`) in `packages/app`: 14 files / 91 tests pass.
- `npx vitest run tests/unit/invoiceDetailsLink.spec.ts` in `packages/api`: passes.
- `npx vue-tsc --noEmit -p tsconfig.json` (app) exit 0; the emit keeps its
  pre-existing `as RawNewInvoice` cast (form model vs payload type optionality).
- `oxfmt --check` clean; root `lint`/`format:check` run by the commit hook.
- **Not verified here**: the unlink round trip in a browser (clear the client on an
  existing invoice, save, reopen) and the new api rejection seen from the SPA. Both
  need the test stack.
