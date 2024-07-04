import { type FastifyInstance } from 'fastify'
import { TRPCError } from '@trpc/server'
import { t } from '../index.js'
import { z } from 'zod'

import { client } from '../../zod/client.js'
import {
  createClient,
  findClients,
  updateClient,
  searchClients
} from '../../repositories/client.js'

export const adminClientRoutes = ({
  // fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  createClient: procedure.input(client).mutation(async ({ input }) => {
    const result = await createClient(input)
    if (result) return result
    if (result) return result
    throw new TRPCError({ code: 'BAD_REQUEST' })
  }),
  getClients: procedure.query(async () => {
    const clients = await findClients({
      criteria: {}
    })
    return clients || []
  }),
  updateClient: procedure.input(client).mutation(async ({ input }) => {
    if (input.id) {
      const result = await updateClient(
        {
          id: input.id
        },
        input
      )
      if (result) return result
    }
    throw new TRPCError({ code: 'BAD_REQUEST' })
  }),
  searchClients: procedure
    .input(
      z.object({
        name: z.string()
      })
    )
    .query(async ({ input }) => {
      const { name } = input
      const clients = await searchClients({
        criteria: {
          name
        }
      })
      if (clients) return clients
      throw new TRPCError({ code: 'BAD_REQUEST' })
    })
})
