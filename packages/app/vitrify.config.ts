import type { VitrifyConfig } from 'vitrify'
import { certificateFor } from 'devcert'
import QuasarComponentsPlugin from '@simsustech/quasar-components/vite-plugin'
import ModularApiQuasarComponentsPlugin from '@modular-api/quasar-components/vite-plugin'
export default async function ({ mode, command }): Promise<VitrifyConfig> {
  const config: VitrifyConfig = {
    plugins: [QuasarComponentsPlugin(), ModularApiQuasarComponentsPlugin()],
    vitrify: {
      lang: process.env.VITE_LANG,
      productName: 'SlimFact',
      hooks: {
        onSetup: [new URL('src/setup.ts', import.meta.url)]
      },
      sass: {
        variables: {
          // $primary: '#990000'
          $primary: process.env.SASS_VARIABLE_PRIMARY,
          $secondary: process.env.SASS_VARIABLE_SECONDARY,
          $accent: process.env.SASS_VARIABLE_ACCENT,
          $dark: process.env.SASS_VARIABLE_DARK,
          $positive: process.env.SASS_VARIABLE_POSITIVE,
          $negative: process.env.SASS_VARIABLE_NEGATIVE,
          $info: process.env.SASS_VARIABLE_INFO,
          $warning: process.env.SASS_VARIABLE_WARNING
        }
      },
      ssr: {
        serverModules: []
      },
      manualChunks: ['zod'],
      pwa: {
        manifest: {
          name: 'SlimFact',
          short_name: 'SlimFact',
          icons: [
            {
              src: './logo.svg',
              sizes: 'any',
              type: 'image/svg+xml'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,pdf}'],
          navigateFallbackDenylist: [/^\/(oidc|interaction)/]
        }
      }
      // pwa: true
    },
    quasar: {
      extras: ['material-icons', 'fontawesome-v6'],
      framework: {
        components: [
          // Deprecated
        ],
        iconSet: 'svg-material-icons',
        plugins: ['Dialog', 'Notify', 'Loading', 'Meta']
      }
    }
  }
  if (mode === 'development') {
    config.server = {
      https: await certificateFor('vitrify.local')
    }
  }
  return config
}
