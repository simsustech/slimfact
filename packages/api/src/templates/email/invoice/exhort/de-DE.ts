import { c } from 'compress-tag'

const subject = `Mahnung zur Rechnung \\{{numberPrefix}}\\{{number}}`
const body = c`</p>Sehr geehrte(r) {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

<p>laut unseren Unterlagen ist die Zahlung für die Rechnung \\{{numberPrefix}}\\{{number}} überfällig.</p>

<p>Wir bitten Sie, den offenen Betrag von {{totalIncludingTax}} innerhalb von 5 Tagen auf das Konto mit der IBAN {{companyDetails.iban}} lautend auf {{companyDetails.name}} unter Angabe der Rechnungsnummer zu überweisen.</p>

<p>Sie können die Rechnung auch <a href="\\{{invoiceUrl}}">hier</a> einsehen.</p>

<p>Sollte die Zahlung nicht fristgerecht eingehen, sehen wir uns gezwungen, weitere rechtliche Schritte einzuleiten.</p>

<p>Mit freundlichen Grüßen</p>

<p>{{companyDetails.name}}</p>`

export { subject, body }
