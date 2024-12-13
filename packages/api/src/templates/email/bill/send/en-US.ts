import { c } from 'compress-tag'

const subject = `View or pay your outstanding bill`
const body = c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

<p>In the attachment you can find the bill with an amount due of {{amountDue}}.
We would like to request you to pay this amount with the link below.</p>

<p>You can view and pay the bill <a href="\\{{invoiceUrl}}">here</a>.

<p>If you have any questions about this bill, you can contact us.</p>

<p>Kind regards,</p>

<p>{{companyDetails.name}}</p>`

export { subject, body }
