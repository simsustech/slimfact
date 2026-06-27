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
  const composeArgs =
    process.env.COMPOSE_ARGS ||
    [
      '-f',
      `${root}/docker-compose.test.yaml`,
      '-f',
      `${root}/docker-compose.test.stripe.yaml`
    ].join(' ')
  console.log(`[global-setup] Tearing down test stack (${composeArgs})…`)
  execSync(`docker compose ${composeArgs} down --volumes --remove-orphans`, {
    stdio: 'inherit',
    timeout: 30000
  })
  console.log('[global-setup] Starting test stack…')
  execSync(`docker compose ${composeArgs} up -d api`, {
    stdio: 'inherit',
    timeout: 60000
  })
  console.log('[global-setup] Waiting for API to be healthy…')
  execSync(
    'timeout 120 sh -c "while ! curl -sk http://localhost:3001 > /dev/null 2>&1; do sleep 2; done"',
    { stdio: 'inherit', timeout: 130000 }
  )
  console.log('[global-setup] API ready, database reseeded.')
}
