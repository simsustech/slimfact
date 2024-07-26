import type { FastifyInstance } from 'fastify'
import modularApiPlugin from '@modular-api/api'
import { createAccountMethods } from '@modular-api/fastify-oidc/kysely'
import { createRouter, createContext } from './trpc/index.js'
import env from '@vitrify/tools/env'
import { fastifySsrPlugin as appSsrPlugin } from '@slimfact/app/fastify-ssr-plugin'
import { onRendered as appOnRendered } from '@slimfact/app/hooks'
import { db as kysely } from '../src/kysely/index.js'
// import { createOrderHandler } from '@modular-api/fastify-cart'
import {
  type FastifyCheckoutPaymentHandler,
  createCashPaymentHandler,
  createInvoiceHandler,
  createMolliePaymentHandler,
  createBankTransferPaymentHandler
} from '@modular-api/fastify-checkout'
import { initialize } from './pgboss.js'

const getString = (str: string) => str
const host = getString(__HOST__)

const sassVariables = {
  $primary:
    env.read('SASS_VARIABLE_PRIMARY') || env.read('VITE_SASS_VARIABLE_PRIMARY'),
  $secondary:
    env.read('SASS_VARIABLE_SECONDARY') ||
    env.read('VITE_SASS_VARIABLE_SECONDARY'),
  $accent:
    env.read('SASS_VARIABLE_ACCENT') || env.read('VITE_SASS_VARIABLE_ACCENT'),
  $dark: env.read('SASS_VARIABLE_DARK') || env.read('VITE_SASS_VARIABLE_DARK'),
  $positive:
    env.read('SASS_VARIABLE_POSITIVE') ||
    env.read('VITE_SASS_VARIABLE_POSITIVE'),
  $negative:
    env.read('SASS_VARIABLE_NEGATIVE') ||
    env.read('VITE_SASS_VARIABLE_NEGATIVE'),
  $info: env.read('SASS_VARIABLE_INFO') || env.read('VITE_SASS_VARIABLE_INFO'),
  $warning:
    env.read('SASS_VARIABLE_WARNING') || env.read('VITE_SASS_VARIABLE_WARNING')
}

/**
 * Only used in SSR/SSG
 */
export default async function (fastify: FastifyInstance) {
  const hostname = env.read('API_HOSTNAME') || env.read('VITE_API_HOSTNAME')

  if (!hostname)
    throw new Error(
      'Please define a API_HOSTNAME or VITE_API_HOSTNAME environment variable'
    )

  console.log('Running setup function....')
  const accountMethods = await createAccountMethods(
    fastify,
    kysely,
    {
      OTP_SECRET: env.read('OTP_SECRET') || env.read('VITE_OTP_SECRET'),
      OTP_VALIDITY_SECONDS:
        env.read('OTP_VALIDITY_SECONDS') ||
        env.read('VITE_OTP_VALIDITY_SECONDS'),
      EMAIL_FOOTER: env.read('EMAIL_FOOTER') || env.read('VITE_EMAIL_FOOTER')
    },
    env.read('VITE_LANG') || 'en-US'
  )

  // const orderHandler = createOrderHandler({
  //   fastify,
  //   kysely,
  //   options: {}
  // })

  const cashPaymentHandler = createCashPaymentHandler({
    fastify,
    kysely
  })

  const bankTransferPaymentHandler = createBankTransferPaymentHandler({
    fastify,
    kysely
  })

  let molliePaymentHandler: FastifyCheckoutPaymentHandler | undefined
  if (env.read('VITE_MOLLIE_API_KEY') || env.read('MOLLIE_API_KEY')) {
    molliePaymentHandler = createMolliePaymentHandler({
      fastify,
      kysely,
      options: {
        apiKey: env.read('VITE_MOLLIE_API_KEY') || env.read('MOLLIE_API_KEY'),
        hostname
      }
    })
  }

  const invoiceHandler = createInvoiceHandler({
    fastify,
    kysely,
    paymentHandlers: {
      mollie: molliePaymentHandler,
      cash: cashPaymentHandler,
      bankTransfer: bankTransferPaymentHandler
    }
  })

  const clients = [
    {
      client_id:
        env.read('OIDC_CLIENT_ID') ||
        env.read('VITE_OIDC_CLIENT_ID') ||
        'slimfact',
      client_name: 'SlimFact webapp',
      logo_uri: 'https://www.slimfact.app/logo.png',
      grant_types: ['authorization_code', 'refresh_token'],
      scope: 'openid offline_access profile email api',
      client_secret: 'secret',
      redirect_uris: [`https://${hostname}/redirect`],
      token_endpoint_auth_method: 'none',
      'urn:custom:client:allowed-cors-origins': [`https://${hostname}`]
    }
  ]

  if (
    env.read('VITE_PETBOARDING_CLIENT_HOSTNAME') ||
    env.read('PETBOARDING_CLIENT_HOSTNAME')
  ) {
    clients.push({
      client_id: 'petboarding',
      client_name: 'Petboarding',
      logo_uri: 'https://www.petboarding.app/logo.png',
      grant_types: ['authorization_code', 'refresh_token'],
      scope: 'openid offline_access profile email api',
      client_secret: 'secret',
      redirect_uris: [
        `https://${
          env.read('VITE_PETBOARDING_CLIENT_HOSTNAME') ||
          env.read('PETBOARDING_CLIENT_HOSTNAME')
        }/callback/slimfact`
      ],
      token_endpoint_auth_method: 'none',
      'urn:custom:client:allowed-cors-origins': [`https://${hostname}`]
    })
  }

  fastify.register(modularApiPlugin, {
    kysely,
    cors: {
      origin: [`https://${hostname}`]
    },
    trpc: {
      createRouter,
      createContext
    },
    oidc: {
      issuerName:
        env.read('OIDC_ISSUER_NAME') || env.read('VITE_OIDC_ISSUER_NAME'),
      locale: env.read('VITE_LANG') || 'en-US',
      sassVariables,
      issuer: `https://${hostname}`,
      accountMethods,
      firstPartyClients: ['slimfact'],
      jwksURL: new URL('jwks.json', import.meta.url),
      configuration: {
        cookies: {
          // https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#cookieskeys
          keys: (
            env.read('OIDC_COOKIES_KEYS') || env.read('VITE_OIDC_COOKIES_KEYS')
          ).split(',')
        },
        routes: {
          authorization: '/authorize',
          token: '/oauth/token'
        },
        clients: [
          {
            client_id:
              env.read('OIDC_CLIENT_ID') ||
              env.read('VITE_OIDC_CLIENT_ID') ||
              'slimfact',
            client_name: 'SlimFact webapp',
            logo_uri: 'https://www.slimfact.app/logo.png',
            grant_types: ['authorization_code', 'refresh_token'],
            scope: 'openid offline_access profile email api',
            client_secret: 'secret',
            redirect_uris: [`https://${hostname}/redirect`],
            token_endpoint_auth_method: 'none',
            'urn:custom:client:allowed-cors-origins': [`https://${hostname}`]
          }
          // {
          //   client_id: 'petboarding',
          //   client_name: 'Petboarding',
          //   logo_uri: 'https://www.petboarding.app/logo.png',
          //   grant_types: ['authorization_code', 'refresh_token'],
          //   scope: 'openid offline_access profile email api',
          //   client_secret: 'secret',
          //   redirect_uris: [`https://localhost:3000/callback/slimfact`],
          //   token_endpoint_auth_method: 'none',
          //   'urn:custom:client:allowed-cors-origins': [`https://${hostname}`]
          // }
        ],
        scopes: ['openid', 'offline_access', 'profile', 'email', 'api'],
        claims: {
          acr: null,
          auth_time: null,
          iss: null,
          openid: ['sub'],
          sid: null,
          profile: ['name', 'picture'],
          email: ['email', 'email_verified'],
          api: ['roles']
        }
      }
    },
    nodemailer: {
      defaults: { from: env.read('MAIL_FROM') || env.read('VITE_MAIL_FROM') },
      transport: {
        host: env.read('MAIL_HOST') || env.read('VITE_MAIL_HOST'),
        port: Number(env.read('MAIL_PORT') || env.read('VITE_MAIL_PORT')),
        secure:
          (env.read('MAIL_SECURE') || env.read('VITE_MAIL_SECURE')) === 'false'
            ? false
            : true,
        auth:
          (env.read('MAIL_USER') || env.read('VITE_MAIL_USER')) &&
          (env.read('MAIL_PASS') || env.read('VITE_MAIL_PASS'))
            ? {
                user: env.read('MAIL_USER') || env.read('VITE_MAIL_USER'),
                pass: env.read('MAIL_PASS') || env.read('VITE_MAIL_PASS')
              }
            : {}
      }
    },
    configuration: () => ({
      LANG: env.read('VITE_LANG') || 'en-US',
      COUNTRY: env.read('VITE_COUNTRY') || 'NL',
      TITLE: env.read('VITE_TITLE') || 'SlimFact',
      SASS_VARIABLES: sassVariables
    }),
    checkout: {
      paymentHandlers: {
        cash: cashPaymentHandler,
        bankTransfer: bankTransferPaymentHandler,
        mollie: molliePaymentHandler
      },
      invoiceHandler
    }
  })

  fastify.register(appSsrPlugin, {
    host,
    onRendered: appOnRendered
  })

  const boss = await initialize({ fastify })
  fastify.decorate('pg-boss', boss)

  fastify.addHook('onClose', async () => {
    await boss.stop()
  })
}
