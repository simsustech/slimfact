import * as z from 'zod'

export const numberPrefixValidation = {
  id: z.number().optional(),
  name: z.string(),
  template: z.string()
}

export const numberPrefix = z.object(numberPrefixValidation)

export type NumberPrefix = z.infer<typeof numberPrefix>
