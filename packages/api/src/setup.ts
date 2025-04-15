import type { FastifyInstance } from 'fastify'
import modularApiPlugin from '@modular-api/api'
import { createAccountMethods } from '@modular-api/fastify-oidc/kysely'
import { createRouter, createContext } from './trpc/index.js'
import env from '@vitrify/tools/env'
// @ts-expect-error no types
import { fastifySsrPlugin as appSsrPlugin } from '@slimfact/app/fastify-ssr-plugin'
// @ts-expect-error no types
import { onRendered as appOnRendered } from '@slimfact/app/hooks'
import { db as kysely } from '../src/kysely/index.js'
// import { createOrderHandler } from '@modular-api/fastify-cart'
import {
  type FastifyCheckoutPaymentHandler,
  type CheckoutPluginOptionsPaymentHandlers,
  createCashPaymentHandler,
  createInvoiceHandler,
  createMolliePaymentHandler,
  createBankTransferPaymentHandler,
  createSmartpinPaymentHandler,
  createPinPaymentHandler
} from '@modular-api/fastify-checkout'
import { initialize } from './pgboss.js'
import type { ClientMetadata } from 'oidc-provider'

const getString = (str: string) => str
// @ts-expect-error vitrify variable
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
  const corsOrigin = [`https://${hostname}`]

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

  let pinPaymentHandler: FastifyCheckoutPaymentHandler | undefined

  if (
    env.read('PIN_ENABLED') === 'true' ||
    env.read('VITE_PIN_ENABLED') === 'true'
  ) {
    pinPaymentHandler = createPinPaymentHandler({
      fastify,
      kysely
    })
  }

  let molliePaymentHandler:
    | CheckoutPluginOptionsPaymentHandlers['mollie']
    | undefined
  if (env.read('VITE_MOLLIE_API_KEY') || env.read('MOLLIE_API_KEY')) {
    const mollieProfiles = Object.keys({
      ...process.env,
      ...import.meta.env
    }).filter(
      (envVar) =>
        envVar.includes('MOLLIE_API_KEY_') ||
        envVar.includes('VITE_MOLLIE_API_KEY_')
    )
    // molliePaymentHandler = createMolliePaymentHandler({
    //   fastify,
    //   kysely,
    //   options: {
    //     apiKey: env.read('VITE_MOLLIE_API_KEY') || env.read('MOLLIE_API_KEY'),
    //     hostname
    //   }
    // })

    const profiles = {
      default: createMolliePaymentHandler({
        fastify,
        kysely,
        options: {
          apiKey: env.read('VITE_MOLLIE_API_KEY') || env.read('MOLLIE_API_KEY'),
          hostname
        }
      }),
      ...mollieProfiles.reduce(
        (acc, cur) => {
          acc[cur.replace('VITE_', '').replace('MOLLIE_API_KEY_', '')] =
            createMolliePaymentHandler({
              fastify,
              kysely,
              options: {
                apiKey: env.read(cur),
                hostname
              }
            })
          return acc
        },
        {} as Record<string, FastifyCheckoutPaymentHandler>
      )
    }

    molliePaymentHandler = {
      profiles
    }
  }

  let smartpinPaymentHandler: FastifyCheckoutPaymentHandler | undefined

  if (
    env.read('SMARTPIN_ENABLED') === 'true' ||
    env.read('VITE_SMARTPIN_ENABLED') === 'true'
  ) {
    smartpinPaymentHandler = createSmartpinPaymentHandler({
      fastify,
      kysely,
      options: {
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
      bankTransfer: bankTransferPaymentHandler,
      smartpin: smartpinPaymentHandler,
      pin: pinPaymentHandler
    }
  })

  const clients: ClientMetadata[] = [
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
    const petboardingClientHostname =
      env.read('VITE_PETBOARDING_CLIENT_HOSTNAME') ||
      env.read('PETBOARDING_CLIENT_HOSTNAME')
    clients.push({
      client_id: 'petboarding',
      client_name: 'Petboarding',
      logo_uri: 'https://www.petboarding.app/logo.png',
      grant_types: ['authorization_code', 'refresh_token'],
      scope: 'openid offline_access profile email api',
      client_secret: 'secret',
      redirect_uris: [`https://${petboardingClientHostname}/callback/slimfact`],
      token_endpoint_auth_method: 'none',
      'urn:custom:client:allowed-cors-origins': [`https://${hostname}`]
    })
  }

  await fastify.register(modularApiPlugin, {
    kysely,
    cors: {
      origin: corsOrigin
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
      jwksURL: new URL('jwks/jwks.json', import.meta.url),
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
        clients,
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
        },
        issueRefreshToken: async function (ctx, client) {
          return (
            client.grantTypeAllowed('refresh_token') &&
            client.clientId === 'petboarding'
          )
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
      SASS_VARIABLES: sassVariables,
      PAYMENT_HANDLERS: {
        cash: cashPaymentHandler !== void 0,
        pin: pinPaymentHandler !== void 0,
        ideal: molliePaymentHandler !== void 0,
        bankTransfer: bankTransferPaymentHandler !== void 0,
        smartpin: smartpinPaymentHandler !== void 0
      }
    }),
    checkout: {
      paymentHandlers: {
        cash: cashPaymentHandler,
        bankTransfer: bankTransferPaymentHandler,
        mollie: molliePaymentHandler,
        smartpin: smartpinPaymentHandler
      },
      invoiceHandler
    }
  })

  await fastify.register(appSsrPlugin, {
    host,
    onRendered: appOnRendered
  })

  const boss = await initialize({ fastify })
  fastify.decorate('pg-boss', boss)

  fastify.addHook('onClose', async () => {
    await boss.stop()
  })
}
