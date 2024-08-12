import type { FastifyInstance } from 'fastify'
import { t } from '../index.js'
import { z } from 'zod'
import { subscription } from '../../zod/subscription.js'
import {
  createSubscription,
  findSubscriptions,
  updateSubscription
} from '../../repositories/subscription.js'
import { TRPCError } from '@trpc/server'
import { startSubscription, stopSubscription } from '../../pgboss.js'

export const adminSubscriptionRoutes = ({
  procedure,
  fastify
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  createSubscription: procedure
    .input(subscription)
    .mutation(async ({ input }) => {
      const result = await createSubscription({
        numberPrefixTemplate: input.numberPrefixTemplate,
        currency: input.currency,
        lines: JSON.stringify(input.lines),
        discounts: JSON.stringify(input.discounts),
        surcharges: JSON.stringify(input.surcharges),
        paymentTermDays: input.paymentTermDays,
        locale: input.locale,
        startDate: input.startDate,
        endDate: input.endDate,
        companyId: input.companyId,
        clientId: input.clientId,
        cronSchedule: input.cronSchedule,
        name: input.name,
        type: input.type
      })
      if (result) return result
      if (result) return result
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }),
  updateSubscription: procedure
    .input(subscription)
    .mutation(async ({ input }) => {
      if (input.id) {
        await stopSubscription(input.id)
        const result = await updateSubscription(
          {
            id: input.id
          },
          {
            numberPrefixTemplate: input.numberPrefixTemplate,
            currency: input.currency,
            lines: JSON.stringify(input.lines),
            discounts: JSON.stringify(input.discounts),
            surcharges: JSON.stringify(input.surcharges),
            paymentTermDays: input.paymentTermDays,
            locale: input.locale,
            startDate: input.startDate,
            endDate: input.endDate,
            companyId: input.companyId,
            clientId: input.clientId,
            cronSchedule: input.cronSchedule,
            name: input.name,
            type: input.type
          }
        )
        if (input.active) startSubscription({ id: input.id, fastify })
        if (result) return result
      }
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }),
  startSubscription: procedure
    .input(
      z.object({
        id: z.number()
      })
    )
    .mutation(async ({ input }) => {
      const result = await updateSubscription(
        {
          id: input.id
        },
        {
          active: true
        }
      )
      if (result) {
        startSubscription({ id: input.id, fastify })
      }
    }),
  stopSubscription: procedure
    .input(
      z.object({
        id: z.number()
      })
    )
    .mutation(async ({ input }) => {
      const result = await updateSubscription(
        {
          id: input.id
        },
        {
          active: false
        }
      )
      stopSubscription(input.id)
      return result
    }),
  getSubscriptions: procedure
    .input(
      z
        .object({
          companyId: z.number().nullable().optional(),
          clientId: z.number().nullable().optional(),
          active: z.boolean().optional(),
          pagination: z
            .object({
              limit: z.number(),
              offset: z.number(),
              sortBy: z.literal('id'),
              descending: z.boolean()
            })
            .optional()
        })
        .optional()
    )
    .query(async ({ input }) => {
      let { companyId, clientId } = input || {}
      const pagination = input?.pagination
      const active = input?.active
      if (companyId === null) companyId = NaN
      if (clientId === null) clientId = NaN
      const subscriptions = await findSubscriptions({
        criteria: {
          companyId,
          clientId,
          active
        },
        pagination
      })

      return subscriptions || []
    })
})
