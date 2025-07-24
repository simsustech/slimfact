import { c } from 'compress-tag'

const subject = `Invoice \\{{numberPrefix}}\\{{number}}`
const body = c`
  </p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>In the attachment you can find invoice \\{{numberPrefix}}\\{{number}} for our services.</p>
  {{#unless paid}}
  <p>We would like to ask you to pay the amount of {{totalIncludingTax}} within {{paymentTermDays}} days (before \\{{dueDate}}) on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>
  {{/unless}}

  <p><b>We would kindly ask you to confirm that you have received this invoice by opening the invoice with the link below.</b></p>

  <p>You can also view and pay the invoice <a href="\\{{invoiceUrl}}">here</a>.

  <p>If you have any questions about this invoice, you can contact us.</p>

  <p>Kind regards,</p>

  <p>{{companyDetails.name}}</p>`

export { subject, body }
