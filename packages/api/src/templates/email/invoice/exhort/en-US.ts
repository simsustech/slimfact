import { c } from 'compress-tag'

const subject = `Exhortation invoice \\{{numberPrefix}}\\{{number}}`
const body = c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

<p>According to our administration the payment for invoice \\{{numberPrefix}}\\{{number}} is overdue.</p>

<p>We would like to ask you to pay the open amount of {{totalIncludingTax}} within 5 days on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>

<p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

<p>If the payment is not received we will be required to take further legal steps.</p>

<p>Kind regards,</p>

<p>{{companyDetails.name}}</p>`

export { subject, body }
