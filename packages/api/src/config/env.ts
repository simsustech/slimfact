import { read, required } from './index.js'

export const appConfig = {
  apiHost: required('API_HOST'),

  otpSecret: required('OTP_SECRET'),
  otpValiditySeconds: read('OTP_VALIDITY_SECONDS'),

  oidcIssuerName: read('OIDC_ISSUER_NAME'),
  oidcClientId: read('OIDC_CLIENT_ID') || 'slimfact',
  oidcClientSecret: required('OIDC_CLIENT_SECRET'),
  oidcCookiesKeys: required('OIDC_COOKIES_KEYS'),

  mailFrom: read('MAIL_FROM'),
  mailHost: read('MAIL_HOST') || 'localhost',
  mailPort: Number(read('MAIL_PORT') || '465'),
  mailSecure: read('MAIL_SECURE') !== 'false',
  mailUser: read('MAIL_USER'),
  mailPass: read('MAIL_PASS'),
  emailFooter: read('EMAIL_FOOTER'),

  sourceColor: read('SOURCE_COLOR') || '#00a4e6',
  lang: read('VITE_LANG') || 'en-US',
  country: read('VITE_COUNTRY') || 'NL',
  title: read('VITE_TITLE') || 'SlimFact',

  modularapiDefaultEmail: read('MODULARAPI_DEFAULT_EMAIL'),
  modularapiDefaultPassword: read('MODULARAPI_DEFAULT_PASSWORD'),

  pinEnabled: read('PIN_ENABLED') === 'true',

  mollieApiKey: read('MOLLIE_API_KEY'),
  mollieApiKeyProfiles: read('MOLLIE_API_KEY_PROFILES'),
  stripeApiKey: read('STRIPE_API_KEY'),
  stripeWebhookSecret: read('STRIPE_WEBHOOK_SECRET'),

  weroPaymentHandler: read('WERO_PAYMENT_HANDLER'),
  creditcardPaymentHandler: read('CREDITCARD_PAYMENT_HANDLER'),

  petboardingClientHost: read('PETBOARDING_CLIENT_HOST'),

  rateLimitPerMinute: read('RATE_LIMIT_PER_MINUTE') || '1000000',
  debug: read('DEBUG'),
  dateFormat: read('DATE_FORMAT') || 'DD-MM-YYYY',

  oidcApiClientIds: read('OIDC_API_CLIENT_IDS'),

  bankingApiUrl: read('BANKING_API_URL'),
  bankingApiKey: read('BANKING_API_KEY'),
  bankingSyncCron: read('BANKING_SYNC_CRON') || '*/15 7-23 * * *',
  bankingSyncWaitMs: Number(read('BANKING_SYNC_WAIT_MS') || '120000'),
  bankingIngestDisabled: read('BANKING_INGEST_DISABLED') === 'true',

  /**
   * Admin "invoice paid" notification address. When empty, notifications fall
   * back to the invoice's companyDetails.email.
   */
  adminNotificationEmail: read('ADMIN_NOTIFICATION_EMAIL')
} as const

export type AppConfig = typeof appConfig

/**
 * True when a banking-api proxy key AND url are configured. The banking module
 * is inert (no cron, tame router results) until both are set — a key without a
 * URL would otherwise start a cron worker that can never reach the proxy.
 */
export const bankingEnabled = (): boolean =>
  !!appConfig.bankingApiKey && !!appConfig.bankingApiUrl
