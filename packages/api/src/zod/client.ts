import * as z from 'zod'

export const clientValidation = {
  id: z.number().optional(),
  number: z.string().optional().nullable(),
  address: z.string(),
  city: z.string(),
  companyName: z.string().nullable().optional(),
  contactPersonName: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  vatIdNumber: z.string().nullable().optional(),
  cocNumber: z.string().nullable().optional(),
  email: z.string().email(),
  postalCode: z.string(),
  accountId: z.number().nullable().optional()
}

export const client = z.object(clientValidation)

export type Client = z.infer<typeof client>
