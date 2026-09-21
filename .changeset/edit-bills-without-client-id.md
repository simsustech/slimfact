---
"@slimfact/app": patch
---

Edit a bill whose client came from details alone, and fetch the document-form
lists on demand instead of on every page mount.

`InvoiceForm` gated its lines/discounts/surcharges section on
`companyId != null && clientId != null`. A document whose client is invoicing
details without a linked record — filled through the select's edit button, which
is exactly how a walk-in client is captured — therefore hid its own line list:
there was nothing to edit. The section now shows when either a `clientId` **or**
`clientDetails.email` is present, mirroring the rule the client select already
applied when deciding whether the field was satisfied.

The company, client and number-prefix lists were fetched at page mount by the
bills, invoices, receipts, subscriptions and exports pages, so opening any of
them ran the invoice form's supporting queries whether or not a dialog would ever
be opened. The three composables are lazy now (`activate()`), and every consumer
calls it at the point the data is actually needed: the document dialog on open,
the filter selects on their filter event, and the settings pages on mount. The
`getInvoices` page's own data is unchanged and starts at the same time it always
did.

The suggestion count went the same way. It was fetched by the layout on every
admin page, and because it rides the same tRPC batch as the page's own queries,
building the entire suggestion list delayed the page. It is now started from an
idle callback after the page has settled, which puts it in a **separate** batch
(`admin.getInvoices,admin.getInvoices` then `admin.listSuggestions`).

The e2e `fillComboboxes` helper opened a select with Playwright's
`locator.click()`. Inside a dialog taller than the 720px default viewport the
field sits outside it: Playwright refuses the click and its attempt to scroll
fights the dialog's own scroll container, producing the visible up/down jitter.
The helper now clicks the `.q-field__control` in the DOM, which the select handles
the same way and which no scrolling behaviour can veto.

A seeded walk-in bill (2026-15, `clientDetails` with no `clientId`) and an
invoice-flow spec cover the edit path end to end.
