import * as z from 'zod'

export const companyValidation = {
  id: z.number().optional(),
  name: z.string(),
  contactPersonName: z.string().nullable().optional(),
  address: z.string(),
  postalCode: z.string(),
  city: z.string(),
  country: z.string(),
  telephoneNumber: z.string().nullable().optional(),
  cocNumber: z.string(),
  vatIdNumber: z.string(),
  iban: z.string(),
  bic: z.string(),
  email: z.string().email(),
  website: z.union([z.string().url().nullish(), z.literal('')]),
  emailBcc: z.union([
    z.literal(''),
    z
      .string()
      .refine((emailValue) =>
        emailValue
          .split(',')
          .every((item) => z.string().email().nullish().safeParse(item).success)
      )
  ]),

  prefix: z.string(),
  logoSvg: z.string().nullable().optional(),
  defaultNumberPrefixTemplate: z.string().nullable().optional(),
  defaultLocale: z.string().nullable().optional(),
  defaultCurrency: z
    .union([z.literal('EUR'), z.literal('USD')])
    .nullable()
    .optional()
}

export const company = z.object(companyValidation)

export type Company = z.infer<typeof company>
