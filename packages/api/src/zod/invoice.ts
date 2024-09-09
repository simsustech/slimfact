import * as z from 'zod'
import { company } from './company'
import { client } from './client'
import {
  PaymentStatus,
  InvoiceStatus
} from '@modular-api/fastify-checkout/types'

export { PaymentStatus, InvoiceStatus }

const invoiceLineValidation = z.object({
  quantity: z.number(),
  quantityPerMille: z.boolean(),
  description: z.string(),
  listPrice: z.number(),
  discount: z.number(),
  taxRate: z.number(),
  listPriceIncludesTax: z.boolean()
})

const invoiceDiscountSurchargeValidation = z.object({
  description: z.string().nullable().optional(),
  listPrice: z.number(),
  taxRate: z.number(),
  listPriceIncludesTax: z.boolean()
})

export const invoiceValidation = {
  id: z.number().optional(),
  uuid: z.string().optional(),
  companyPrefix: z.string().optional(),
  currency: z.union([z.literal('EUR'), z.literal('USD')]),
  locale: z.string().optional(),
  numberPrefix: z.string().optional().nullable(),
  numberPrefixTemplate: z.string(),
  paymentTermDays: z.number(),
  requiredDownPaymentAmount: z.number().optional(),
  lines: invoiceLineValidation.array(),
  discounts: invoiceDiscountSurchargeValidation.array().optional().nullable(),
  surcharges: invoiceDiscountSurchargeValidation.array().optional().nullable(),
  companyId: z.number().optional(),
  companyDetails: company.optional(),
  clientId: z.number().optional().nullable(),
  clientDetails: client.optional(),
  projectId: z.string().nullable().optional(),
  notes: z.string().optional().nullable(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  reminderSentDates: z.array(z.string()).optional(),
  paymentId: z.number().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable()
}

export const invoice = z.object(invoiceValidation)

export type Invoice = z.infer<typeof invoice>
