import { c } from 'compress-tag'

const subject = `Factuur {{numberPrefix}}{{number}} betaald · {{totalIncludingTax}}`
const body = c`<p>De factuur {{numberPrefix}}{{number}} voor {{clientDetails.companyName}} is betaald.</p>

<p>Ontvangen bedrag: {{totalIncludingTax}}.</p>

<p>U kunt de factuur <a href="{{invoiceUrl}}">hier</a> bekijken.</p>`

export { subject, body }
