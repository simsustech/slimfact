import { type FastifyInstance } from 'fastify'
import { TRPCError } from '@trpc/server'
import { t } from '../index.js'

import { numberPrefix } from '../../zod/numberPrefix.js'
import {
  createNumberPrefix,
  findNumberPrefixes,
  updateNumberPrefix
} from '../../repositories/numberPrefix.js'

export const adminNumberPrefixRoutes = ({
  // fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  createNumberPrefix: procedure
    .input(numberPrefix)
    .mutation(async ({ input }) => {
      const result = await createNumberPrefix(input)
      if (result) return result
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }),
  getNumberPrefixes: procedure.query(async () => {
    const numberPrefixes = await findNumberPrefixes({
      criteria: {}
    })
    return numberPrefixes || []
  }),
  updateNumberPrefix: procedure
    .input(numberPrefix)
    .mutation(async ({ input }) => {
      if (input.id) {
        const result = await updateNumberPrefix(
          {
            id: input.id
          },
          input
        )
        if (result) return result
      }
      throw new TRPCError({ code: 'BAD_REQUEST' })
    })
})
