import type { BankingApi } from './client.js'

declare module 'fastify' {
  interface FastifyInstance {
    banking: {
      getClient: () => BankingApi | null
    }
    eventBus: {
      bus: import('@modular-api/event-bus').EventBus<
        import('@slimfact/banking-api/events').BankEventSchemas
      >
    }
  }
}
