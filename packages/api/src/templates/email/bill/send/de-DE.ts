import { c } from 'compress-tag'

const subject = `Ihren offenen Beleg ansehen oder bezahlen`
const body = c`</p>Sehr geehrte(r) {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

<p>im Anhang finden Sie den Beleg über einen fälligen Betrag von {{amountDue}}.
Wir möchten Sie bitten, diesen Betrag **über den unten stehenden Link** zu begleichen.</p>

<p>Sie können den Beleg <a href="\\{{invoiceUrl}}">hier</a> einsehen und bezahlen.</p>

<p>Wenn Sie Fragen zu diesem Beleg haben, können Sie uns gerne kontaktieren.</p>

<p>Mit freundlichen Grüßen</p>

<p>{{companyDetails.name}}</p>`

export { subject, body }
