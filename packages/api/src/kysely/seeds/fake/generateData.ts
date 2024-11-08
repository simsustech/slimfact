import { faker } from '@faker-js/faker'
import { Clients, Companies } from '../../types.js'
import type { Insertable } from 'kysely'
import { RawInvoiceLine } from '@modular-api/fastify-checkout'

const NUMBER_OF_COMPANIES = 3
const NUMBER_OF_CLIENTS = 500
const NUMBER_OF_INVOICE_LINES = 200

const createCompany = () => ({
  name: faker.company.name(),
  address: faker.location.streetAddress(),
  postalCode: faker.location.zipCode(),
  city: faker.location.city(),
  country: faker.location.country(),
  email: faker.internet.email(),
  telephoneNumber: faker.phone.number(),
  cocNumber: faker.commerce.isbn(),
  iban: faker.finance.iban(),
  bic: faker.finance.bic(),
  prefix: faker.company.buzzNoun(),
  vatIdNumber: faker.number.bigInt({ min: 1e7, max: 1e8 }).toString(),
  emailBcc: faker.internet.email()
})

const createClient = () => ({
  companyName: faker.company.name(),
  address: faker.location.streetAddress(),
  postalCode: faker.location.zipCode(),
  city: faker.location.city(),
  country: faker.location.country(),
  email: faker.internet.email(),
  contactPersonName: faker.person.fullName()
})

const createInvoiceLine = () => ({
  description: faker.commerce.productName(),
  discount: 0,
  listPrice: Math.round(Math.random() * 1e5),
  listPriceIncludesTax: true,
  quantity: 1,
  quantityPerMille: false,
  taxRate: 21
})

export default () => {
  const companies: Insertable<Companies>[] = Array.from(
    { length: NUMBER_OF_COMPANIES },
    createCompany
  ).filter((obj, index, arr) => {
    return (
      arr.findIndex((o) => {
        return o.email === obj.email
      }) === index
    )
  })

  const clients: Insertable<Clients>[] = Array.from(
    { length: NUMBER_OF_CLIENTS },
    createClient
  ).filter((obj, index, arr) => {
    return (
      arr.findIndex((o) => {
        return o.email === obj.email
      }) === index
    )
  })

  const invoiceLines: RawInvoiceLine[] = Array.from(
    { length: NUMBER_OF_INVOICE_LINES },
    createInvoiceLine
  )

  return {
    companies,
    clients,
    invoiceLines
  }
}
