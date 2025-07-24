import * as z from 'zod'
import { INVOICE_EVENT_TYPE } from '../kysely/types.js'

export const invoiceEventValidation = {
  id: z.number().optional(),
  invoiceId: z.number(),
  type: z.nativeEnum(INVOICE_EVENT_TYPE),
  timestamp: z.string()
}

export const invoiceEvent = z.object(invoiceEventValidation)

export type InvoiceEvent = z.infer<typeof invoiceEvent>
