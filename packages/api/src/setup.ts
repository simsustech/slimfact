import type { FastifyInstance } from 'fastify'
import modularApiPlugin from '@modular-api/api'
import { createAccountMethods } from '@modular-api/fastify-oidc/kysely'
import rateLimit from '@fastify/rate-limit'
import { createRouter, createContext } from './trpc/index.js'
import { appConfig as config } from './config/env.js'
import { env } from './config/index.js'
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
import { startRelay, createOidcAuthenticate } from './banking/events.js'
import { createEventBusServer } from '@modular-api/event-bus'
import { bankEventSchemas } from '@slimfact/banking-api/events'
import websocketPlugin from '@fastify/websocket'
import { SLIMFACT_ACCOUNT_ROLES } from './zod/account.js'
import healthRoutes from './routes/health.js'
import type { ClientMetadata } from 'oidc-provider'
import { generateTheme } from 'unocss-preset-quasar/theme'
import { createClient } from './banking/client.js'
import {
  sendInvoicePaidNotification,
  type InvoicePaidNotificationDeps
} from './notifications/invoicePaid.js'

const theme = generateTheme(config.sourceColor)
const OIDC_API_CLIENT_IDS = ['petboarding']

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
      OTP_VALIDITY_SECONDS: Number(config.otpValiditySeconds ?? '3600'),
      EMAIL_FOOTER: config.emailFooter ?? ''
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
    wero: config.weroPaymentHandler as 'mollie' | 'stripe' | undefined,
    creditcard: config.creditcardPaymentHandler as
      | 'mollie'
      | 'stripe'
      | undefined
  }

  // Lazy getters: the nodemailer plugin decorates fastify.mailer only after
  // registration completes, so it must be resolved at send time, not here.
  const invoicePaidNotificationDeps: InvoicePaidNotificationDeps = {
    get logger() {
      return fastify.log
    },
    get mailer() {
      return fastify.mailer
    },
    adminNotificationEmail: config.adminNotificationEmail,
    host
  }
  if (!config.adminNotificationEmail) {
    fastify.log.warn(
      'ADMIN_NOTIFICATION_EMAIL not set — paid notifications fall back to companyDetails.email'
    )
  }
  const invoiceHandler = createInvoiceHandler({
    fastify,
    kysely,
    paymentHandlers: {
      mollie: molliePaymentHandler,
      cash: cashPaymentHandler,
      bankTransfer: bankTransferPaymentHandler,
      pin: pinPaymentHandler,
      stripe: stripePaymentHandler
        ? {
            ...stripePaymentHandler,
            webhookSecret: config.stripeWebhookSecret
          }
        : undefined
    },
    options: {
      paymentMethodRouting,
      onInvoicePaid: async (args) => {
        await sendInvoicePaidNotification(args, invoicePaidNotificationDeps)
      }
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
      issuerName: config.oidcIssuerName ?? host,
      locale: config.lang,
      themeColors: theme['colors'],
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
        issueRefreshToken: async function (_ctx, client, code) {
          return (
            client.grantTypeAllowed('refresh_token') &&
            (OIDC_API_CLIENT_IDS.includes(client.clientId) ||
              code.scopes.has('offline_access'))
          )
        },
        ttl: {
          Grant: 90 * 24 * 60 * 60,
          Session: 90 * 24 * 60 * 60,
          RefreshToken: (_ctx, _token, client) => {
            if (OIDC_API_CLIENT_IDS.includes(client.clientId)) {
              return 90 * 24 * 60 * 60
            }

            return 14 * 24 * 60 * 60
          }
        }
      },
      defaultCredentials:
        config.modularapiDefaultEmail && config.modularapiDefaultPassword
          ? {
              email: config.modularapiDefaultEmail,
              password: config.modularapiDefaultPassword
            }
          : undefined
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
      DATE_FORMAT: config.dateFormat,
      SASS_VARIABLES: {},
      PAYMENT_HANDLERS: {
        cash: cashPaymentHandler !== void 0,
        pin: pinPaymentHandler !== void 0,
        bankTransfer: bankTransferPaymentHandler !== void 0,
        wero: !!paymentMethodRouting.wero,
        creditcard: !!paymentMethodRouting.creditcard
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

  // Local event bus (tRPC WS): browsers subscribe with their OAuth token via
  // connectionParams; the relay re-publishes proxy events here (D10/D13/D15).
  const eventBus = createEventBusServer({
    events: bankEventSchemas,
    authenticate: createOidcAuthenticate(fastify),
    canSubscribe: (identity, topic) =>
      topic.startsWith('bank.') &&
      Boolean(
        (
          identity as { account?: { roles?: string[] } }
        ).account?.roles?.includes(SLIMFACT_ACCOUNT_ROLES.ADMINISTRATOR)
      )
  })
  await fastify.register(websocketPlugin)
  fastify.get('/ws', { websocket: true }, (socket, req) =>
    eventBus.handleWS(socket, req)
  )
  fastify.decorate('eventBus', eventBus)

  if (config.bankingApiKey && config.bankingApiUrl) {
    await startRelay({ fastify })
  }

  fastify.decorate('banking', {
    getClient: () => {
      if (!config.bankingApiKey || !config.bankingApiUrl) return null
      return createClient({
        url: config.bankingApiUrl,
        apiKey: config.bankingApiKey
      })
    }
  })

  const boss = await initialize({ fastify })
  fastify.decorate('pg-boss', boss)

  fastify.addHook('onClose', async () => {
    await boss.stop()
  })
}
