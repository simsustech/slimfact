import { c } from 'compress-tag'

const subject = `Rechnung {{numberPrefix}}{{number}} bezahlt · {{totalIncludingTax}}`
const body = c`<p>Die Rechnung {{numberPrefix}}{{number}} für {{clientDetails.companyName}} wurde bezahlt.</p>

<p>Erhaltener Betrag: {{totalIncludingTax}}.</p>

<p>Sie können die Rechnung <a href="{{invoiceUrl}}">hier</a> einsehen.</p>`

export { subject, body }
