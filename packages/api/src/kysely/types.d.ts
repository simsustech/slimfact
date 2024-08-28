import type {
  AccountsTable,
  OidcPayloadsTable,
  AuthenticationMethodsTable
} from '@modular-api/fastify-oidc/kysely'
import type { Database as CartDatabase } from '@modular-api/fastify-cart/kysely'
import type { Database as CheckoutDatabase } from '@modular-api/fastify-checkout/kysely'
import type {
  RawInvoiceLine,
  RawInvoiceDiscount,
  RawInvoiceSurcharge
} from '@modular-api/fastify-checkout'

export interface Clients {
  address: string
  city: string
  companyName: string | null
  contactPersonName: string | null
  country: string
  vatIdNumber: string | null
  createdAt: Generated<string>
  email: string
  id: Generated<number>
  number: string | null
  postalCode: string
  accountId: number | null
}

export interface Companies {
  id: Generated<number>
  address: string
  bic: string
  city: string
  cocNumber: string
  contactPersonName?: string | null
  country: string
  email: string
  emailBcc?: string | null
  iban: string
  logoSvg?: string | null
  name: string
  postalCode: string
  prefix: string
  telephoneNumber?: string | null
  vatIdNumber: string
  website?: string | null
  defaultNumberPrefixTemplate?: string | null
  defaultLocale?: string | null
  defaultCurrency?: 'EUR' | 'USD' | null
  createdAt: Generated<string>
}

export interface NumberPrefixes {
  id: Generated<number>
  name: string
  template: string
}

export interface InitialNumberForPrefixes {
  id: Generated<number>
  companyId: number
  numberPrefix: string
  initialNumber: number
}

export interface EmailTemplates {
  id: Generated<number>
  name: string
  locale: string | null
  subject: string | null
  body: string | null
  createdAt: Generated<string>
}

export interface Subscriptions {
  id: Generated<number>
  uuid: Generated<string>
  name: string | null
  active?: boolean
  companyId: number
  clientId: number
  numberPrefixTemplate: string
  locale: string
  currency: 'EUR' | 'USD'
  lines: JSONColumnType<RawInvoiceLine[], string>
  discounts?: JSONColumnType<RawInvoiceDiscount[], string> | null
  surcharges?: JSONColumnType<RawInvoiceSurcharge[], string> | null
  paymentTermDays: number
  startDate: string
  endDate: string | null
  cronSchedule: string
  type: 'invoice' | 'bill'
  createdAt: Generated<string>
}

export interface DB extends CartDatabase, CheckoutDatabase {
  accounts: AccountsTable
  authenticationMethods: AuthenticationMethodsTable
  oidcPayloads: OidcPayloadsTable
  clients: Clients
  companies: Companies
  numberPrefixes: NumberPrefixes
  initialNumberForPrefixes: InitialNumberForPrefixes
  emailTemplates: EmailTemplates
  subscriptions: Subscriptions
}
