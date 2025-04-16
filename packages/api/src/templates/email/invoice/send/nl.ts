import { c } from 'compress-tag'

const subject = `Factuur \\{{numberPrefix}}\\{{number}}`
const body = c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>Bijgevoegd treft u factuur \\{{numberPrefix}}\\{{number}} aan voor de geleverde diensten.</p>
  {{#unless paid}}
  <p>Gelieve het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} te betalen binnen {{paymentTermDays}} dagen (voor \\{{dueDate}}) op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>
  {{/unless}}
  <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken en betalen.

  <p>Mocht u nog vragen hebben over deze factuur, dan kunt u contact met ons opnemen.</p>

  <p>Met vriendelijke groet,</p>

  <p>{{companyDetails.name}}</p>`

export { subject, body }
