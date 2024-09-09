import { c } from 'compress-tag'

const subject = `Betalingsherinnering factuur \\{{numberPrefix}}\\{{number}}`
const body = c`
  <p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>Uit onze administratie blijkt dat factuur \\{{numberPrefix}}\\{{number}} nog niet is voldaan.</p>

  <p>Wij willen u verzoeken het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} alsnog binnen 7 dagen te betalen op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>

  <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

  <p>Mocht u nog vragen hebben over deze factuur, dan kunt u contact met ons opnemen.</p>

  <p>Met vriendelijke groet,</p>

  <p>{{companyDetails.name}}</p>`

export { subject, body }
