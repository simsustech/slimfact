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
  quantityUnit: z
    .union([z.literal('kg'), z.literal('m'), z.literal('h')])
    .nullable()
    .optional(),
  description: z.string(),
  type: z.string().nullable().optional(),
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
  locale: z.string().optional().nullable(),
  numberPrefix: z.string().optional().nullable(),
  numberPrefixTemplate: z.string(),
  paymentTermDays: z.number(),
  requiredDownPaymentAmount: z.number().optional(),
  lines: invoiceLineValidation.array(),
  discounts: invoiceDiscountSurchargeValidation.array().optional().nullable(),
  surcharges: invoiceDiscountSurchargeValidation.array().optional().nullable(),
  companyId: z.number().nullable().optional(),
  companyDetails: company.optional(),
  clientId: z.number().optional().nullable(),
  clientDetails: client.optional(),
  projectId: z.string().nullable().optional(),
  notes: z.string().optional().nullable(),
  status: z.nativeEnum(InvoiceStatus).nullable().optional(),
  reminderSentDates: z.array(z.string()).optional(),
  paymentId: z.number().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  replaceExistingLinesOfSameType: z.boolean().optional()
}

export const invoice = z.object(invoiceValidation)

export type Invoice = z.infer<typeof invoice>

/**
 * Message when a payload contradicts the link rule, otherwise null.
 *
 * `companyId`/`clientId` are the **link** to the SlimFact record; `companyDetails`
 * and `clientDetails` are the invoicing details printed on the document, which may
 * carry no `id` at all. When both are present they must agree.
 *
 * A missing half is not a contradiction: with no link the procedures take the key
 * from the details (which is how a details-only payload gets linked at all), and
 * details without an id are the unlinked document.
 */
export const detailsLinkMismatch = (input: {
  clientId?: number | null
  clientDetails?: { id?: number | null } | null
  companyId?: number | null
  companyDetails?: { id?: number | null } | null
}): string | null => {
  const pairs = [
    ['client', input.clientId, input.clientDetails?.id],
    ['company', input.companyId, input.companyDetails?.id]
  ] as const

  for (const [name, linkId, detailsId] of pairs) {
    if (linkId != null && detailsId != null && linkId !== detailsId) {
      return `${name}Id (${linkId}) does not match ${name}Details.id (${detailsId})`
    }
  }

  return null
}
