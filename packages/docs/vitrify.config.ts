import type { VitrifyConfig } from 'vitrify'
import { certificateFor } from 'devcert'
import { render } from '@vitrify/tools/render'

export default async function ({ mode, command }): Promise<VitrifyConfig> {
  const config: VitrifyConfig = {
    plugins: [
      {
        name: 'copy-caddyfile',
        closeBundle: () => {
          render({
            inputPath: new URL('./build/Caddyfile', import.meta.url),
            outputPath: new URL(`./dist/static/Caddyfile`, import.meta.url)
          })
        }
      }
    ],
    vitrify: {
      hooks: {
        onSetup: [new URL('src/setup.ts', import.meta.url)]
      },
      sass: {
        variables: {
          $primary: '#00a4e6ff',
          $secondary: '#22c92a',
          $accent: '#eece0cff'
        }
      },
      ssr: {
        serverModules: []
      }
    },
    quasar: {
      extras: ['material-icons'],
      framework: {
        components: [
          // Deprecated
        ],
        iconSet: 'svg-material-icons',
        plugins: ['Dialog', 'Notify']
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
