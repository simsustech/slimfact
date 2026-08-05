import * as z from 'zod'

export const eventTypeEnum = z.enum([
  'invoiceOpened',
  'billCreated',
  'payment',
  'reminder',
  'exhortation'
])

export type EventType = z.infer<typeof eventTypeEnum>

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')

export const getDashboardStatsInput = z
  .object({
    companyIds: z.array(z.number().int().positive()).optional(),
    dateFrom: dateSchema,
    dateTo: dateSchema
  })
  .refine(
    (value) => value.dateFrom <= value.dateTo,
    'dateFrom must be on or before dateTo'
  )

export type GetDashboardStatsInput = z.infer<typeof getDashboardStatsInput>

export const getDashboardActivityInput = z.object({
  companyIds: z.array(z.number().int().positive()).optional(),
  eventTypes: z.array(eventTypeEnum).optional(),
  limit: z.number().int().min(1).max(50).optional().default(20)
})

export type GetDashboardActivityInput = z.infer<
  typeof getDashboardActivityInput
>
