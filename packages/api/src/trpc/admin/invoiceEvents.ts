import { type FastifyInstance } from 'fastify'
import { t } from '../index.js'
import { z } from 'zod'

import {
  findInvoiceEvents,
  getGroupedInvoiceEventsByInvoiceIds
} from 'src/repositories/invoiceEvent.js'

export const adminInvoiceEventsRoutes = ({
  // fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  getInvoiceEvents: procedure
    .input(
      z.object({
        invoiceId: z.number()
      })
    )
    .query(async ({ input }) => {
      if (input.invoiceId) {
        return findInvoiceEvents({
          criteria: {
            invoiceId: input.invoiceId
          }
        })
      }
    }),
  getInvoiceEventsByInvoiceIds: procedure
    .input(
      z.object({
        invoiceIds: z.number().array()
      })
    )
    .query(async ({ input }) => {
      if (input.invoiceIds)
        return getGroupedInvoiceEventsByInvoiceIds(input.invoiceIds)
    })
})
