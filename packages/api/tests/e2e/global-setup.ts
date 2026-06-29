import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

/**
 * Nuke and restart the test stack. The API container's startup command
 * (`npm run migrate:latest && npm run seed:test && npm run start`)
 * handles database setup automatically.
 */
export default async function globalSetup() {
  const root =
    process.env.SLIMFACT_ROOT || resolve(import.meta.dirname, '../../../..')
  const pspOverride = process.env.SLIMFACT_PSP
    ? `-f ${root}/docker-compose.test.${process.env.SLIMFACT_PSP}.yaml`
    : ''
  const composeArgs =
    process.env.COMPOSE_ARGS ||
    [`-f`, `${root}/docker-compose.test.yaml`, pspOverride]
      .filter(Boolean)
      .join(' ')
  execSync(`docker compose ${composeArgs} down --volumes --remove-orphans`, {
    stdio: 'inherit',
    timeout: 30000
  })
  console.log('[global-setup] Starting test stack…')
  execSync(`docker compose ${composeArgs} up -d --wait`, {
    stdio: 'inherit',
    timeout: 60000
  })
  console.log('[global-setup] Stack ready.')
}
