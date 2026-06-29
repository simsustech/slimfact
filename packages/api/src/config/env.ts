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

  sassVariablePrimary: read('SASS_VARIABLE_PRIMARY'),
  sassVariableSecondary: read('SASS_VARIABLE_SECONDARY'),
  sassVariableAccent: read('SASS_VARIABLE_ACCENT'),
  sassVariableDark: read('SASS_VARIABLE_DARK'),
  sassVariablePositive: read('SASS_VARIABLE_POSITIVE'),
  sassVariableNegative: read('SASS_VARIABLE_NEGATIVE'),
  sassVariableInfo: read('SASS_VARIABLE_INFO'),
  sassVariableWarning: read('SASS_VARIABLE_WARNING'),

  modularapiDefaultEmail: read('MODULARAPI_DEFAULT_EMAIL'),
  modularapiDefaultPassword: read('MODULARAPI_DEFAULT_PASSWORD'),

  pinEnabled: read('PIN_ENABLED') === 'true',

  mollieApiKey: read('MOLLIE_API_KEY'),
  mollieApiKeyProfiles: read('MOLLIE_API_KEY_PROFILES'),
  stripeApiKey: read('STRIPE_API_KEY'),
  stripeWebhookSecret: read('STRIPE_WEBHOOK_SECRET'),

  idealPaymentHandler: read('IDEAL_PAYMENT_HANDLER'),
  creditcardPaymentHandler: read('CREDITCARD_PAYMENT_HANDLER'),

  petboardingClientHost: read('PETBOARDING_CLIENT_HOST'),

  rateLimitPerMinute: read('RATE_LIMIT_PER_MINUTE') || '1000000',
  debug: read('DEBUG'),

  oidcApiClientIds: read('OIDC_API_CLIENT_IDS')
} as const

export type AppConfig = typeof appConfig
