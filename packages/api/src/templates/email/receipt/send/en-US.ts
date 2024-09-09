import { c } from 'compress-tag'

const subject = `Receipt`
const body = c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

<p>In the attachment you can find the receipt for the amount of {{totalIncludingTax}}.</p>

<p>You can also view receipt <a href="\\{{invoiceUrl}}">here</a>.

<p>If you have any questions about this receipt, you can contact us.</p>

<p>Kind regards,</p>

<p>{{companyDetails.name}}</p>`

export { subject, body }
