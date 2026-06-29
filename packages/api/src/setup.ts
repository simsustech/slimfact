import type { FastifyInstance } from 'fastify'
import modularApiPlugin from '@modular-api/api'
import { createAccountMethods } from '@modular-api/fastify-oidc/kysely'
import rateLimit from '@fastify/rate-limit'
import { createRouter, createContext } from './trpc/index.js'
import { appConfig as config, env } from './config/index.js'
// @ts-expect-error no types
import { fastifySsrPlugin as appSsrPlugin } from '@slimfact/app/fastify-ssr-plugin'
import {
  hooks
  // @ts-expect-error no types
} from '@slimfact/app/hooks'
import { db as kysely } from '../src/kysely/index.js'

import {
  type FastifyCheckoutPaymentHandler,
  type CheckoutPluginOptionsPaymentHandlers,
  createCashPaymentHandler,
  createInvoiceHandler,
  createMolliePaymentHandler,
  createBankTransferPaymentHandler,
  createPinPaymentHandler,
  createStripePaymentHandler
} from '@modular-api/fastify-checkout'
import { initialize } from './pgboss.js'
import healthRoutes from './routes/health.js'
import type { ClientMetadata } from 'oidc-provider'
import { generateTheme } from 'unocss-preset-quasar/theme'

const OIDC_API_CLIENT_IDS = ['petboarding']

import { initialize } from './pgboss.js'
import healthRoutes from './routes/health.js'
import type { ClientMetadata } from 'oidc-provider'

/**
 * Only used in SSR/SSG
 */
export default async function (fastify: FastifyInstance) {
  const { apiHost: host } = config
  const corsOrigin = [`https://${host}`]

  console.log('Running setup function....')

  await fastify.register(rateLimit, {
    max: Number(config.rateLimitPerMinute),
    timeWindow: '1 minute'
  })

  await fastify.register(healthRoutes)

  const accountMethods = await createAccountMethods(
    fastify,
    kysely,
    {
      OTP_SECRET: config.otpSecret,
      OTP_VALIDITY_SECONDS: config.otpValiditySeconds,
      EMAIL_FOOTER: config.emailFooter
    },
    config.lang
  )

  const cashPaymentHandler = createCashPaymentHandler({
    fastify,
    kysely
  })

  const bankTransferPaymentHandler = createBankTransferPaymentHandler({
    fastify,
    kysely
  })

  let pinPaymentHandler: FastifyCheckoutPaymentHandler | undefined

  if (config.pinEnabled) {
    pinPaymentHandler = createPinPaymentHandler({
      fastify,
      kysely
    })
  }

  let molliePaymentHandler:
    | CheckoutPluginOptionsPaymentHandlers['mollie']
    | undefined
  if (config.mollieApiKey) {
    const mollieProfiles = Object.keys({
      ...process.env,
      ...import.meta.env
    }).filter(
      (envVar) =>
        envVar.includes('MOLLIE_API_KEY_') ||
        envVar.includes('VITE_MOLLIE_API_KEY_')
    )

    const profiles = {
      default: createMolliePaymentHandler({
        fastify,
        kysely,
        options: {
          apiKey: config.mollieApiKey,
          host
        }
      }),
      ...mollieProfiles.reduce(
        (acc, cur) => {
          acc[cur.replace('VITE_', '').replace('MOLLIE_API_KEY_', '')] =
            createMolliePaymentHandler({
              fastify,
              kysely,
              options: {
                apiKey: env.read(cur) || '',
                host
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

  let stripePaymentHandler: CheckoutPluginOptionsPaymentHandlers['stripe']

  if (config.stripeApiKey) {
    const stripeProfiles = Object.keys({
      ...process.env,
      ...import.meta.env
    }).filter(
      (envVar) =>
        envVar.includes('STRIPE_API_KEY_') ||
        envVar.includes('VITE_STRIPE_API_KEY_')
    )

    const profiles = {
      default: createStripePaymentHandler({
        fastify,
        kysely,
        options: {
          apiKey: config.stripeApiKey
        }
      }),
      ...stripeProfiles.reduce(
        (acc, cur) => {
          acc[cur.replace('VITE_', '').replace('STRIPE_API_KEY_', '')] =
            createStripePaymentHandler({
              fastify,
              kysely,
              options: {
                apiKey: env.read(cur) || ''
              }
            })
          return acc
        },
        {} as Record<string, FastifyCheckoutPaymentHandler>
      )
    }

    stripePaymentHandler = {
      profiles
    }
  }

  const paymentMethodRouting = {
    ideal: config.idealPaymentHandler as 'mollie' | 'stripe' | undefined,
    creditcard: config.creditcardPaymentHandler as
      | 'mollie'
      | 'stripe'
      | undefined
  }

  const invoiceHandler = createInvoiceHandler({
    fastify,
    kysely,
    paymentHandlers: {
      mollie: molliePaymentHandler,
      cash: cashPaymentHandler,
      bankTransfer: bankTransferPaymentHandler,
      pin: pinPaymentHandler,
      stripe: {
        ...stripePaymentHandler,
        webhookSecret: config.stripeWebhookSecret
      }
    },
    options: {
      paymentMethodRouting
    }
  })

  const clients: ClientMetadata[] = [
    {
      client_id: config.oidcClientId,
      client_name: 'SlimFact webapp',
      logo_uri: 'https://www.slimfact.app/logo.png',
      grant_types: ['authorization_code', 'refresh_token'],
      scope: 'openid offline_access profile email api',
      client_secret: config.oidcClientSecret,
      redirect_uris: [`https://${host}/redirect`],
      token_endpoint_auth_method: 'none',
      'urn:custom:client:allowed-cors-origins': [`https://${host}`]
    }
  ]

  if (config.petboardingClientHost) {
    clients.push({
      client_id: 'petboarding',
      client_name: 'Petboarding',
      logo_uri: 'https://www.petboarding.app/logo.png',
      grant_types: ['authorization_code', 'refresh_token'],
      scope: 'openid offline_access profile email api',
      client_secret: config.oidcClientSecret,
      redirect_uris: [
        `https://${config.petboardingClientHost}/callback/slimfact`
      ],
      token_endpoint_auth_method: 'none',
      'urn:custom:client:allowed-cors-origins': [`https://${host}`]
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
      issuerName: config.oidcIssuerName,
      locale: config.lang,
      themeColors: theme['colors'],
      {},
      issuer: `https://${host}`,
      accountMethods,
      firstPartyClients: ['slimfact'],
      jwksURL: new URL('jwks/jwks.json', import.meta.url),
      configuration: {
        cookies: {
          keys: config.oidcCookiesKeys.split(',')
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
        issueRefreshToken: async function (ctx, client, code) {
          return (
            client.grantTypeAllowed('refresh_token') &&
            (OIDC_API_CLIENT_IDS.includes(client.clientId) ||
              code.scopes.has('offline_access'))
          )
        },
        ttl: {
          Grant: 90 * 24 * 60 * 60,
          Session: 90 * 24 * 60 * 60,
          RefreshToken: (ctx, token, client) => {
            if (OIDC_API_CLIENT_IDS.includes(client.clientId)) {
              return 90 * 24 * 60 * 60
            }

            return 14 * 24 * 60 * 60
          }
        }
      },
      defaultCredentials: {
        email: config.modularapiDefaultEmail,
        password: config.modularapiDefaultPassword
      }
    },
    nodemailer: {
      defaults: { from: config.mailFrom },
      transport: {
        host: config.mailHost,
        port: config.mailPort,
        secure: config.mailSecure,
        auth:
          config.mailUser && config.mailPass
            ? {
                user: config.mailUser,
                pass: config.mailPass
              }
            : {}
      }
    },
    configuration: () => ({
      API_HOST: host,
      LANG: config.lang,
      COUNTRY: config.country,
      TITLE: config.title,
      SASS_VARIABLES: {},
      PAYMENT_HANDLERS: {
        cash: cashPaymentHandler !== void 0,
        pin: pinPaymentHandler !== void 0,
        bankTransfer: bankTransferPaymentHandler !== void 0,
        ideal: !!molliePaymentHandler || !!stripePaymentHandler,
        creditcard: !!stripePaymentHandler || !!molliePaymentHandler
      },
      PAYMENT_METHOD_ROUTING: paymentMethodRouting
    }),
    checkout: {
      paymentHandlers: {
        cash: cashPaymentHandler,
        bankTransfer: bankTransferPaymentHandler,
        mollie: molliePaymentHandler,
        stripe: stripePaymentHandler
      },
      invoiceHandler
    }
  })

  await fastify.register(appSsrPlugin, {
    host,
    onAppRendered: hooks.onAppRendered,
    onTemplateRendered: hooks.onTemplateRendered
  })

  const boss = await initialize({ fastify })
  fastify.decorate('pg-boss', boss)

  fastify.addHook('onClose', async () => {
    await boss.stop()
  })
}
