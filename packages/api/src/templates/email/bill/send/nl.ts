import { c } from 'compress-tag'

const subject = `Openstaande rekening`
const body = c`
  <p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>Bijgevoegd treft u uw rekening aan met een openstaand bedrag ter hoogte van {{amountDue}}.</p>

  <p>U kunt de rekening ook <a href="\\{{invoiceUrl}}">hier</a> bekijken en betalen.

  <p>Mocht u nog vragen hebben over deze rekening, dan kunt u contact met ons opnemen.</p>

  <p>Met vriendelijke groet,</p>

  <p>{{companyDetails.name}}</p>`

export { subject, body }
