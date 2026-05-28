import { c } from 'compress-tag'

const subject = `Rechnung \\{{numberPrefix}}\\{{number}}`
const body = c`
  </p>Sehr geehrte(r) {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>im Anhang finden Sie die Rechnung \\{{numberPrefix}}\\{{number}} für unsere Leistungen.</p>
  {{#unless paid}}
  <p>Wir bitten Sie, den Betrag von {{totalIncludingTax}} innerhalb von {{paymentTermDays}} Tagen (bis zum \\{{dueDate}}) auf das Konto mit der IBAN {{companyDetails.iban}} lautend auf {{companyDetails.name}} unter Angabe der Rechnungsnummer zu überweisen.</p>
  {{/unless}}

  <p><b>Wir bitten Sie höflich, den Erhalt dieser Rechnung zu bestätigen, indem Sie die Rechnung über den unten stehenden Link öffnen.</b></p>

  <p>Sie können die Rechnung auch <a href="\\{{invoiceUrl}}">hier</a> einsehen und bezahlen.</p>

  <p>Wenn Sie Fragen zu dieser Rechnung haben, können Sie uns gerne kontaktieren.</p>

  <p>Mit freundlichen Grüßen</p>

  <p>{{companyDetails.name}}</p>`

export { subject, body }
