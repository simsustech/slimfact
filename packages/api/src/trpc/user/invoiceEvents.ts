import { t } from '../index.js'
import * as z from 'zod'
import type { FastifyInstance } from 'fastify'
import { createInvoiceEvent } from 'src/repositories/invoiceEvent.js'
import { INVOICE_EVENT_TYPE } from 'src/kysely/types.js'

export const userInvoiceEventsRoutes = ({
  // fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  emailOpened: procedure
    .input(
      z.object({
        invoiceId: z.number()
      })
    )
    .mutation(async ({ input }) => {
      if (input.invoiceId)
        createInvoiceEvent({
          invoiceId: input.invoiceId,
          type: INVOICE_EVENT_TYPE.EMAIL_OPENED
        })
    })
})
