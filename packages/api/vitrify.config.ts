import type { VitrifyConfig } from 'vitrify'
import { getCertificate } from '@vitejs/plugin-basic-ssl'
import { loadEnv } from 'vite'

export default async function ({
  mode,
  command
}: {
  mode: string
  command: string
}): Promise<VitrifyConfig> {
  const env = loadEnv(mode, process.cwd(), '')

  const config: VitrifyConfig = {
    vitrify: {
      lang: env.VITE_LANG,
      hooks: {
        onSetup: [new URL('src/setup.ts', import.meta.url)]
      },
      ssr: {
        fastify: {
          routerOptions: {
            maxParamLength: 5000
          },
          bodyLimit: 5e6
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
          'stripe',
          'playwright',
          'svgo',
          'compress-tag',
          'short-uuid',
          '@slimfact/tools',
          '@myriaddreamin/typst-ts-node-compiler',
          '@myriaddreamin/typst-ts'
        ]
      },
      manualChunks: ['api.config', 'zod', 'date-fns', 'types']
    }
  }
  if (mode === 'development') {
    const certificate = await getCertificate(
      'node_modules/.vite/basic-ssl',
      '',
      ['vitrify.test']
    )
    config.server = {
      https: {
        cert: certificate,
        key: certificate
      }
    }
    // When using NetBird tunnel, set the public origin so Vite generates correct URLs
    if (env.VITE_API_HOST?.includes('netbird')) {
      config.server.origin = `https://${env.VITE_API_HOST}`
    }
  }
  return config
}
