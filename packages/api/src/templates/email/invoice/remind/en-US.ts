import { c } from 'compress-tag'

const subject = `Payment reminder invoice \\{{numberPrefix}}\\{{number}}`
const body = c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

<p>According to our administration the payment for invoice \\{{numberPrefix}}\\{{number}} is overdue.</p>

<p>We would like to ask you to pay the open amount of {{totalIncludingTax}} within 7 days on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>

<p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

<p>If you have any questions about this invoice, you can contact us.</p>

<p>Kind regards,</p>

<p>{{companyDetails.name}}</p>`

export { subject, body }
