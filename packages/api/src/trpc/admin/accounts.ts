import { TRPCError } from '@trpc/server'
import { t } from '../index.js'
import * as z from 'zod'
import { SLIMFACT_ACCOUNT_ROLES } from '../../zod/account.js'
import {
  findAccount,
  findAccounts,
  getAccountsCount,
  updateAccount
} from '../../repositories/account.js'
import type { FastifyInstance } from 'fastify'

export const adminAccountRoutes = ({
  // fastify,
  procedure
}: {
  fastify?: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  getAccount: procedure
    .input(
      z.object({
        id: z.number()
      })
    )
    .query(async ({ input }) => {
      const { id } = input
      if (id) {
        const account = await findAccount({
          criteria: {
            id
          }
        })
        return account
      }
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }),
  getAccounts: procedure
    .input(
      z.object({
        criteria: z
          .object({
            name: z.string().optional(),
            email: z.string().optional(),
            roles: z.array(z.nativeEnum(SLIMFACT_ACCOUNT_ROLES)).optional()
          })
          .optional(),
        pagination: z
          .object({
            limit: z.number(),
            offset: z.number(),
            sortBy: z
              .union([z.literal('id'), z.literal('email'), z.literal('name')])
              .nullable(),
            descending: z.boolean()
          })
          .optional()
      })
    )
    .query(async ({ input }) => {
      const { criteria, pagination } = input
      const audits = await findAccounts({
        criteria: criteria || {},
        pagination
      })
      if (audits) return audits
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }),
  getAccountsCount: procedure
    .input(
      z
        .object({
          criteria: z
            .object({
              name: z.string().optional(),
              email: z.string().optional(),
              roles: z.array(z.nativeEnum(SLIMFACT_ACCOUNT_ROLES)).optional()
            })
            .optional()
        })
        .optional()
    )
    .query(async ({ input }) => {
      const criteria = input?.criteria || {}
      const count = await getAccountsCount({ criteria })
      return count
    }),
  findAccounts: procedure
    .input(
      z.object({
        ids: z.number().array().optional(),
        email: z.string().optional(),
        searchPhrase: z.string().optional()
      })
    )
    .query(async ({ input }) => {
      const { ids, email, searchPhrase } = input
      if (
        (email && email.length > 2) ||
        (searchPhrase && searchPhrase.length > 2)
      ) {
        const accounts = await findAccounts({
          criteria: {
            email,
            searchPhrase
          }
        })
        return accounts
      } else if (ids) {
        const accounts = await findAccounts({
          criteria: {
            ids
          }
        })
        return accounts
      }
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }),
  addRole: procedure
    .input(
      z.object({
        id: z.number(),
        role: z.nativeEnum(SLIMFACT_ACCOUNT_ROLES)
      })
    )
    .mutation(async ({ input }) => {
      const { id, role } = input
      const account = await findAccount({
        criteria: {
          id
        }
      })
      if (account) {
        const roles = account.roles || []
        roles.push(role)
        if (account) {
          await updateAccount(
            {
              id
            },
            {
              roles: JSON.stringify(roles)
            }
          )
          return true
        }
      }
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }),
  removeRole: procedure
    .input(
      z.object({
        id: z.number(),
        role: z.nativeEnum(SLIMFACT_ACCOUNT_ROLES)
      })
    )
    .mutation(async ({ input }) => {
      const { id, role } = input
      const account = await findAccount({
        criteria: {
          id
        }
      })
      if (account) {
        const roles = account.roles || []
        roles?.splice(roles?.indexOf(role))
        await updateAccount(
          {
            id
          },
          {
            roles: JSON.stringify(roles)
          }
        )
        return true
      }
      throw new TRPCError({ code: 'BAD_REQUEST' })
    })
})
