import { type FastifyInstance } from 'fastify'
import { TRPCError } from '@trpc/server'
import { t } from '../index.js'
import { z } from 'zod'
import { optimize } from 'svgo'

import { company } from '../../zod/company.js'

import {
  createCompany,
  findCompanies,
  updateCompany,
  searchCompanies,
  findCompany
} from '../../repositories/company.js'

export const adminCompanyRoutes = ({
  // fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  createCompany: procedure.input(company).mutation(async ({ input }) => {
    const {
      name,
      contactPersonName,
      address,
      postalCode,
      city,
      country,
      email,
      emailBcc,
      cocNumber,
      iban,
      bic,
      vatIdNumber,
      telephoneNumber,
      website,
      prefix,
      defaultNumberPrefixTemplate,
      defaultLocale,
      defaultCurrency
    } = input

    let logoSvg = input.logoSvg

    if (logoSvg) {
      const result = optimize(logoSvg, {
        multipass: true
      })
      logoSvg = result.data
    }

    const result = await createCompany({
      name,
      contactPersonName,
      address,
      postalCode,
      city,
      country,
      email,
      emailBcc,
      cocNumber,
      iban,
      bic,
      vatIdNumber,
      telephoneNumber,
      website,
      prefix,
      logoSvg,
      defaultNumberPrefixTemplate,
      defaultLocale,
      defaultCurrency
    })
    if (result) return result

    throw new TRPCError({ code: 'BAD_REQUEST' })
  }),
  getCompanies: procedure.query(async () => {
    const companies = await findCompanies({
      criteria: {}
    })
    return companies || []
  }),
  getCompany: procedure
    .input(
      z.object({
        id: z.number()
      })
    )
    .query(async ({ input }) => {
      const { id } = input
      const company = await findCompany({
        criteria: {
          id
        }
      })
      if (company) return company

      throw new TRPCError({ code: 'BAD_REQUEST' })
    }),
  updateCompany: procedure.input(company).mutation(async ({ input }) => {
    if (input.id) {
      const {
        name,
        contactPersonName,
        address,
        postalCode,
        city,
        country,
        email,
        emailBcc,
        cocNumber,
        iban,
        bic,
        vatIdNumber,
        telephoneNumber,
        website,
        prefix,
        defaultNumberPrefixTemplate,
        defaultLocale,
        defaultCurrency
      } = input

      let logoSvg = input.logoSvg

      if (logoSvg) {
        const result = optimize(logoSvg, {
          multipass: true
        })
        logoSvg = result.data
      }

      const result = await updateCompany(
        {
          id: input.id
        },
        {
          name,
          contactPersonName,
          address,
          postalCode,
          city,
          country,
          email,
          emailBcc,
          cocNumber,
          iban,
          bic,
          vatIdNumber,
          telephoneNumber,
          website,
          prefix,
          logoSvg,
          defaultNumberPrefixTemplate,
          defaultLocale,
          defaultCurrency
        }
      )
      if (result) return result
    }
    throw new TRPCError({ code: 'BAD_REQUEST' })
  }),
  searchCompanies: procedure.input(z.string()).query(async ({ input }) => {
    const companies = await searchCompanies({
      criteria: {
        name: input
      }
    })
    if (companies) return companies
    throw new TRPCError({ code: 'BAD_REQUEST' })
  })
})
