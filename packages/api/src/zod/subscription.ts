import * as z from 'zod'
import { client } from './client.js'
import { company } from './company.js'

export const subscriptionValidation = {
  id: z.number().optional(),
  uuid: z.string().optional(),
  name: z.string().nullable(),
  active: z.boolean().optional(),
  companyId: z.number(),
  clientId: z.number(),
  numberPrefixTemplate: z.string(),
  locale: z.string(),
  currency: z.union([z.literal('EUR'), z.literal('USD')]),
  lines: z
    .object({
      description: z.string(),
      listPrice: z.number(),
      listPriceIncludesTax: z.boolean(),
      taxRate: z.number(),
      quantity: z.number(),
      quantityPerMille: z.boolean(),
      discount: z.number()
    })
    .array(),
  discounts: z
    .object({
      description: z.string(),
      listPrice: z.number(),
      listPriceIncludesTax: z.boolean(),
      taxRate: z.number()
    })
    .array()
    .optional(),
  surcharges: z
    .object({
      description: z.string(),
      listPrice: z.number(),
      listPriceIncludesTax: z.boolean(),
      taxRate: z.number()
    })
    .array()
    .optional(),
  paymentTermDays: z.number(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  cronSchedule: z.string(),
  type: z.union([z.literal('invoice'), z.literal('bill')]),
  createdAt: z.string().optional(),
  client: client.optional(),
  company: company.optional()
}

export const subscription = z.object(subscriptionValidation)

export type Subscription = z.infer<typeof subscription>
