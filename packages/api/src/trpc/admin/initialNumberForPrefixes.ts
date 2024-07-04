import { type FastifyInstance } from 'fastify'
import { TRPCError } from '@trpc/server'
import { t } from '../index.js'

import { initialNumberForPrefix } from '../../zod/initialNumberForPrefix.js'
import {
  createInitialNumberForPrefix,
  findInitialNumberForPrefixes,
  updateInitialNumberForPrefix
} from '../../repositories/initialNumberForPrefix.js'

export const adminInitialNumberForPrefixRoutes = ({
  // fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  createInitialNumberForPrefix: procedure
    .input(initialNumberForPrefix)
    .mutation(async ({ input }) => {
      const result = await createInitialNumberForPrefix(input)
      if (result) return result
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }),
  getInitialNumberForPrefixes: procedure.query(async () => {
    const initialNumberForPrefixes = await findInitialNumberForPrefixes({
      criteria: {}
    })
    return initialNumberForPrefixes || []
  }),
  updateInitialNumberForPrefix: procedure
    .input(initialNumberForPrefix)
    .mutation(async ({ input }) => {
      if (input.id) {
        const result = await updateInitialNumberForPrefix(
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
