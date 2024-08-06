import { type FastifyInstance } from 'fastify'
// import { TRPCError } from '@trpc/server'
import { t } from '../index.js'

export const adminHealthRoutes = ({
  // fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  healthcheck: procedure.query(async () => {
    return true
  })
})
