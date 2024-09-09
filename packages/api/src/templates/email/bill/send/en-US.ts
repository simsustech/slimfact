import { c } from 'compress-tag'

const subject = `Outstanding bill`
const body = c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

<p>In the attachment you can find the bill with an amount due of {{amountDue}}.</p>

<p>You can also view and pay the bill <a href="\\{{invoiceUrl}}">here</a>.

<p>If you have any questions about this bill, you can contact us.</p>

<p>Kind regards,</p>

<p>{{companyDetails.name}}</p>`

export { subject, body }
