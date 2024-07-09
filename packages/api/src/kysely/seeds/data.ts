import bcrypt from 'bcrypt'
import { c } from 'compress-tag'
import { db } from '../index.js'
import env from '@vitrify/tools/env'
import type { Insertable } from 'kysely'
import type { EmailTemplates, NumberPrefixes } from '../types.js'

const ADMIN_PASSWORD = env.read('MODULARAPI_ADMIN_PASSWORD')
if (!ADMIN_PASSWORD)
  throw new Error('Please provide a MODULARAPI_ADMIN_PASSWORD env variable.')

// Double backslash for two-step compilation
const emailTemplates: Insertable<EmailTemplates>[] = [
  {
    name: 'sendInvoice',
    locale: 'nl',
    subject: `Factuur \\{{numberPrefix}}\\{{number}}`,
    body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>Bijgevoegd treft u factuur \\{{numberPrefix}}\\{{number}} aan voor de geleverde diensten.</p>
  {{#unless paid}}
  <p>Gelieve het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} te betalen binnen {{paymentTermDays}} dagen (voor \\{{dueDate}}) op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>
  {{/unless}}
  <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

  <p>Mocht u nog vragen hebben over deze factuur, dan kunt u contact met ons opnemen.</p>

  <p>Met vriendelijke groet,</p>

  <p>{{companyDetails.name}}</p>`
  },
  {
    name: 'remindInvoice',
    locale: 'nl',
    subject: `Betalingsherinnering factuur \\{{numberPrefix}}\\{{number}}`,
    body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>Uit onze administratie blijkt dat factuur \\{{numberPrefix}}\\{{number}} nog niet is voldaan.</p>

  <p>Wij willen u verzoeken het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} alsnog binnen 7 dagen te betalen op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>

  <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

  <p>Mocht u nog vragen hebben over deze factuur, dan kunt u contact met ons opnemen.</p>

  <p>Met vriendelijke groet,</p>

  <p>{{companyDetails.name}}</p>`
  },
  {
    name: 'exhortInvoice',
    locale: 'nl',
    subject: `Aanmaning factuur \\{{numberPrefix}}\\{{number}}`,
    body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>Uit onze administratie blijkt dat factuur \\{{numberPrefix}}\\{{number}} nog niet is voldaan.</p>

  <p>Wij willen u verzoeken het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} alsnog binnen 5 dagen te betalen op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>

  <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

  <p>Indien de betaling uitblijft zijn we genoodzaakt verdere juridische stappen te nemen.</p>

  <p>Met vriendelijke groet,</p>

  <p>{{companyDetails.name}}</p>`
  },
  {
    name: 'sendBill',
    locale: 'nl',
    subject: `Openstaande rekening`,
    body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>Bijgevoegd treft u uw rekening aan met een openstaand bedrag ter hoogte van {{amountDue}}.</p>

  <p>U kunt de rekening ook <a href="\\{{invoiceUrl}}">hier</a> bekijken en betalen.

  <p>Mocht u nog vragen hebben over deze rekening, dan kunt u contact met ons opnemen.</p>

  <p>Met vriendelijke groet,</p>

  <p>{{companyDetails.name}}</p>`
  },
  {
    name: 'sendReceipt',
    locale: 'nl',
    subject: `Bon`,
    body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>Bijgevoegd treft u uw bon aan voor het bedrag ter hoogte van {{totalIncludingTax}}.</p>

  <p>U kunt de bon ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

  <p>Mocht u nog vragen hebben over deze bon, dan kunt u contact met ons opnemen.</p>

  <p>Met vriendelijke groet,</p>

  <p>{{companyDetails.name}}</p>`
  },
  {
    name: 'sendInvoice',
    locale: 'en-US',
    subject: `Invoice \\{{numberPrefix}}\\{{number}}`,
    body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>In the attachment you can find invoice \\{{numberPrefix}}\\{{number}} for our services.</p>
  {{#unless paid}}
  <p>We would like to ask you to pay the amount of {{totalIncludingTax}} within {{paymentTermDays}} days (before \\{{dueDate}}) on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>
  {{/unless}}
  <p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

  <p>If you have any questions about this invoice, you can contact us.</p>

  <p>Kind regards,</p>

  <p>{{companyDetails.name}}</p>`
  },
  {
    name: 'remindInvoice',
    locale: 'en-US',
    subject: `Payment reminder invoice \\{{numberPrefix}}\\{{number}}`,
    body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>According to our administration the payment for invoice \\{{numberPrefix}}\\{{number}} is overdue.</p>

  <p>We would like to ask you to pay the open amount of {{totalIncludingTax}} within 7 days on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>

  <p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

  <p>If you have any questions about this invoice, you can contact us.</p>

  <p>Kind regards,</p>

  <p>{{companyDetails.name}}</p>`
  },
  {
    name: 'exhortInvoice',
    locale: 'en-US',
    subject: `Exhortation invoice \\{{numberPrefix}}\\{{number}}`,
    body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>According to our administration the payment for invoice \\{{numberPrefix}}\\{{number}} is overdue.</p>

  <p>We would like to ask you to pay the open amount of {{totalIncludingTax}} within 5 days on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>

  <p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

  <p>If the payment is not received we will be required to take further legal steps.</p>

  <p>Kind regards,</p>

  <p>{{companyDetails.name}}</p>`
  },
  {
    name: 'sendBill',
    locale: 'en-US',
    subject: `Outstanding bill`,
    body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>In the attachment you can find the bill with an amount due of {{amountDue}}.</p>

  <p>You can also view and pay the bill <a href="\\{{invoiceUrl}}">here</a>.

  <p>If you have any questions about this bill, you can contact us.</p>

  <p>Kind regards,</p>

  <p>{{companyDetails.name}}</p>`
  },
  {
    name: 'sendReceipt',
    locale: 'en-US',
    subject: `Receipt`,
    body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

  <p>In the attachment you can find the receipt for the amount of {{totalIncludingTax}}.</p>

  <p>You can also view receipt <a href="\\{{invoiceUrl}}">here</a>.

  <p>If you have any questions about this receipt, you can contact us.</p>

  <p>Kind regards,</p>

  <p>{{companyDetails.name}}</p>`
  }
]

const numberPrefixes: Insertable<NumberPrefixes>[] = [
  {
    name: 'YYYY.',
    template: '{{YYYY}}.'
  },
  {
    name: 'companyDetails.prefix-YYYY-',
    template: '{{companyDetails.prefix}}-{{YYYY}}-'
  }
]

// const companies: Insertable<Companies>[] = []
// const clients: Insertable<Clients>[] = []

const seed = async () => {
  await db.insertInto('emailTemplates').values(emailTemplates).execute()
  await db.insertInto('numberPrefixes').values(numberPrefixes).execute()

  // await db.insertInto('companies').values(companies).execute()
  // await db.insertInto('clients').values(clients).execute()

  const adminAccounts = await db
    .insertInto('accounts')
    .values([
      {
        email: 'admin@slimfact.app',
        roles: `["administrator", "employee"]`
      }
    ])
    .returning('id')
    .execute()

  const admin = adminAccounts[0]

  await db
    .insertInto('authenticationMethods')
    .values([
      {
        accountId: admin.id,
        provider: 'native',
        password: await bcrypt.hash(ADMIN_PASSWORD, 10)
      }
    ])
    .execute()
}

await seed()
