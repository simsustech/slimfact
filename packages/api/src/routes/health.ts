import { sql } from 'kysely'
import type { FastifyInstance } from 'fastify'
import { db } from '../kysely/index.js'
import { getBossOrThrow } from '../pgboss.js'

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error'
  db: 'connected' | 'disconnected'
  pgboss: 'connected' | 'disconnected'
  timestamp: string
}

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    const result: HealthStatus = {
      status: 'ok',
      db: 'disconnected',
      pgboss: 'disconnected',
      timestamp: new Date().toISOString()
    }

    try {
      await sql`SELECT 1`.execute(db)
      result.db = 'connected'
    } catch {
      result.status = 'degraded'
    }

    try {
      const boss = getBossOrThrow()
      const isConnected = boss !== null
      result.pgboss = isConnected ? 'connected' : 'disconnected'
      if (!isConnected) result.status = 'degraded'
    } catch {
      result.pgboss = 'disconnected'
      result.status = 'degraded'
    }

    if (result.db !== 'connected' && result.pgboss !== 'connected') {
      result.status = 'error'
    }

    const statusCode = result.status === 'error' ? 503 : 200
    return reply.code(statusCode).send(result)
  })
}
