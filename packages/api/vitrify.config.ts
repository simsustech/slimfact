import type { VitrifyConfig } from 'vitrify'
import { certificateFor } from 'devcert'

export default async function ({
  mode,
  command
}: {
  mode: string
  command: string
}): Promise<VitrifyConfig> {
  const config: VitrifyConfig = {
    vitrify: {
      lang: process.env.VITE_LANG,
      hooks: {
        onSetup: [new URL('src/setup.ts', import.meta.url)]
      },
      ssr: {
        fastify: {
          bodyLimit: 5e6,
          maxParamLength: 5000
        },
        serverModules: [
          '@slimfact/app',
          '@fastify/middie',
          '@fastify/formbody',
          '@fastify/cookie',
          '@fastify/static',
          '@fastify/cors',
          '@modular-api/api',
          '@vitrify/plugin-env',
          '@modular-api/fastify-oidc',
          '@modular-api/oidc-interactions',
          'bcrypt',
          'kysely',
          'jose',
          'oidc-provider',
          'handlebars',
          'otplib',
          'date-holidays',
          'pg',
          'sharp',
          '@mollie/api-client',
          'axios',
          'playwright',
          'svgo',
          'compress-tag'
        ]
      },
      manualChunks: ['api.config', 'zod', 'date-fns', 'types']
    }
  }
  if (mode === 'development') {
    config.server = {
      https: await certificateFor('vitrify.local')
    }
  }
  return config
}
