import * as z from 'zod'

export const clientValidation = {
  id: z.number().optional(),
  number: z.string().optional().nullable(),
  address: z.string(),
  city: z.string(),
  companyName: z.string().optional(),
  contactPersonName: z.string().optional(),
  country: z.string().optional(),
  email: z.string().email(),
  postalCode: z.string(),
  accountId: z.number().nullable().optional()
}

export const client = z.object(clientValidation)

export type Client = z.infer<typeof client>
