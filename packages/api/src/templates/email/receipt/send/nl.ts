import { c } from 'compress-tag'

const subject = `Bekijk uw bon`
const body = c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>Bijgevoegd treft u uw bon aan voor het bedrag ter hoogte van {{totalIncludingTax}}.</p>

  <p>U kunt de bon ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

  <p>Mocht u nog vragen hebben over deze bon, dan kunt u contact met ons opnemen.</p>

  <p>Met vriendelijke groet,</p>

  <p>{{companyDetails.name}}</p>`

export { subject, body }
