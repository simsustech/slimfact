import { c } from 'compress-tag'

const subject = `Invoice {{numberPrefix}}{{number}} paid · {{totalIncludingTax}}`
const body = c`<p>Invoice {{numberPrefix}}{{number}} for {{clientDetails.companyName}} has been paid.</p>

<p>Amount received: {{totalIncludingTax}}.</p>

<p>You can view the invoice <a href="{{invoiceUrl}}">here</a>.</p>`

export { subject, body }
