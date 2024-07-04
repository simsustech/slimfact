import type { FastifyInstance } from 'fastify'

/**
 * Only used in SSR/SSG
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export default async function (fastify: FastifyInstance) {
  console.log('Running setup function....')
}
/* eslint-enable @typescript-eslint/no-unused-vars */
