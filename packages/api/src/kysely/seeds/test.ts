import { hashPassword } from '@vitrify/tools/scrypt'
import { db } from '../index.js'
import type { Insertable } from 'kysely'
import type { Clients, Companies, NumberPrefixes } from '../types.js'

const ADMIN_PASSWORD = 'Sif5uEG5hcTH'

// Double backslash to escape compress-tag
// const emailTemplates: Insertable<EmailTemplates>[] = [
//   {
//     name: 'sendInvoice',
//     locale: 'nl',
//     subject: `Factuur \\{{numberPrefix}}\\{{number}}`,
//     body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>Bijgevoegd treft u factuur \\{{numberPrefix}}\\{{number}} aan voor de geleverde diensten.</p>

//   <p>Gelieve het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} te betalen binnen {{paymentTermDays}} dagen (voor \\{{dueDate}}) op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>

//   <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

//   <p>Mocht u nog vragen hebben over deze factuur, dan kunt u contact met ons opnemen.</p>

//   <p>Met vriendelijke groet,</p>

//   <p>{{companyDetails.name}}</p>`
//   },
//   {
//     name: 'remindInvoice',
//     locale: 'nl',
//     subject: `Betalingsherinnering factuur \\{{numberPrefix}}\\{{number}}`,
//     body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>Uit onze administratie blijkt dat factuur \\{{numberPrefix}}\\{{number}} nog niet is voldaan.</p>

//   <p>Wij willen u verzoeken het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} alsnog binnen 7 dagen te betalen op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>

//   <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

//   <p>Mocht u nog vragen hebben over deze factuur, dan kunt u contact met ons opnemen.</p>

//   <p>Met vriendelijke groet,</p>

//   <p>{{companyDetails.name}}</p>`
//   },
//   {
//     name: 'exhortInvoice',
//     locale: 'nl',
//     subject: `Aanmaning factuur \\{{numberPrefix}}\\{{number}}`,
//     body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>Uit onze administratie blijkt dat factuur \\{{numberPrefix}}\\{{number}} nog niet is voldaan.</p>

//   <p>Wij willen u verzoeken het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} alsnog binnen 5 dagen te betalen op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>

//   <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

//   <p>Indien de betaling uitblijft zijn we genoodzaakt verdere juridische stappen te nemen.</p>

//   <p>Met vriendelijke groet,</p>

//   <p>{{companyDetails.name}}</p>`
//   },
//   {
//     name: 'sendInvoice',
//     locale: 'en-US',
//     subject: `Invoice \\{{numberPrefix}}\\{{number}}`,
//     body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>In the attachment you can find invoice \\{{numberPrefix}}\\{{number}} for our services.</p>

//   <p>We would like to ask you to pay the amount of {{totalIncludingTax}} within {{paymentTermDays}} days (before \\{{dueDate}}) on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>

//   <p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

//   <p>If you have any questions about this invoice, you can contact us.</p>

//   <p>Kind regards,</p>

//   <p>{{companyDetails.name}}</p>`
//   },
//   {
//     name: 'remindInvoice',
//     locale: 'en-US',
//     subject: `Payment reminder invoice \\{{numberPrefix}}\\{{number}}`,
//     body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>According to our administration the payment for invoice \\{{numberPrefix}}\\{{number}} is overdue.</p>

//   <p>We would like to ask you to pay the open amount of {{totalIncludingTax}} within 7 days on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>

//   <p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

//   <p>If you have any questions about this invoice, you can contact us.</p>

//   <p>Kind regards,</p>

//   <p>{{companyDetails.name}}</p>`
//   },
//   {
//     name: 'exhortInvoice',
//     locale: 'en-US',
//     subject: `Exhortation invoice \\{{numberPrefix}}\\{{number}}`,
//     body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>According to our administration the payment for invoice \\{{numberPrefix}}\\{{number}} is overdue.</p>

//   <p>We would like to ask you to pay the open amount of {{totalIncludingTax}} within 5 days on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>

//   <p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

//   <p>If the payment is not received we will be required to take further legal steps.</p>

//   <p>Kind regards,</p>

//   <p>{{companyDetails.name}}</p>`
//   }
// ]

const numberPrefixes: Insertable<NumberPrefixes>[] = [
  {
    name: 'YYYY.',
    template: '{{YYYY}}.'
  }
]

const companies: Insertable<Companies>[] = [
  {
    name: 'Acme Inc',
    address: 'Hoofdweg 1',
    postalCode: '1234 AB',
    city: 'Amsterdam',
    country: 'NL',
    email: 'john@acme.local',
    cocNumber: '123456789',
    iban: 'NL82RABO6579776978',
    bic: 'RABONL2U',
    prefix: 'acme',
    vatIdNumber: 'NL12345678',
    emailBcc: 'bcc@acme.local'
  }
]

const clients: Insertable<Clients>[] = [
  {
    companyName: 'Goods For All',
    address: 'Hoofdweg 2',
    postalCode: '1234 AB',
    city: 'Amsterdam',
    country: 'NL',
    email: 'jane@goodsforall.local',
    contactPersonName: 'Jane Doe'
  }
]

const seed = async () => {
  // await db.insertInto('emailTemplates').values(emailTemplates).execute()
  await db.insertInto('numberPrefixes').values(numberPrefixes).execute()

  await db.insertInto('companies').values(companies).execute()
  await db.insertInto('clients').values(clients).execute()

  const adminAccounts = await db
    .insertInto('accounts')
    .values([
      {
        email: 'admin@slimfact.app',
        roles: `["administrator", "pointofsale"]`
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
        password: await hashPassword(ADMIN_PASSWORD)
      }
    ])
    .execute()
}

seed()
