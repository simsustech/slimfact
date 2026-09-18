---
"@slimfact/app": patch
---

Stop the invoice form from relinking a document whose client was cleared, and
reject payloads whose details contradict the link.

`InvoiceForm`'s `setValue` resolved a missing `clientId` from `clientDetails.id`
and assigned it to `companyId`. The assignment was wrong, but resolving a link out
of the details was the real problem: `companyId`/`clientId` are the **link** to the
SlimFact records, while `companyDetails`/`clientDetails` are the invoicing
**details** printed on the document, which may carry no `id` at all. The company
and client selects now bind only the keys, assigned unconditionally so a reset
cannot keep a previous document's selection.

A details id matters on the write path, not on read: the create/update procedures
take the stored key _from_ `clientDetails.id`/`companyDetails.id` when no key is
supplied. The form therefore submits the details without their id
(`withoutDetailsId`). Before this, an edited document whose client was cleared still
carried the details id loaded from the api, so saving put the client back —
clearing the select could not unlink anything.

`detailsLinkMismatch` (`@slimfact/api`'s zod invoice module) now rejects a
create/update payload whose details id disagrees with a link that is also present,
so the contradiction cannot reach the database from any api caller.
