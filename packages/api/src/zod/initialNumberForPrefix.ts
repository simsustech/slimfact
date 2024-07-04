import * as z from 'zod'

export const initialNumberForPrefixValidation = {
  id: z.number().optional(),
  companyId: z.number(),
  numberPrefix: z.string(),
  initialNumber: z.number()
}

export const initialNumberForPrefix = z.object(initialNumberForPrefixValidation)

export type InitialNumberForPrefix = z.infer<typeof initialNumberForPrefix>
