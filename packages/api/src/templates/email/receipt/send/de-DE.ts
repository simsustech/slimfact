import { c } from 'compress-tag'

const subject = `Ihre Quittung ansehen`
const body = c`</p>Sehr geehrte(r) {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

<p>im Anhang finden Sie die Quittung über den Betrag von {{totalIncludingTax}}.</p>

<p>Sie können die Quittung auch <a href="\\{{invoiceUrl}}">hier</a> einsehen.</p>

<p>Wenn Sie Fragen zu dieser Quittung haben, können Sie uns gerne kontaktieren.</p>

<p>Mit freundlichen Grüßen</p>

<p>{{companyDetails.name}}</p>`

export { subject, body }
