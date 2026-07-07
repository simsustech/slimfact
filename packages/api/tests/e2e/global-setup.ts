import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

/**
 * Start the test stack with linked fastify-checkout for guard verification.
 * The API container runs migrate + seed:test + start.
 */
export default async function globalSetup() {
  const root =
    process.env.SLIMFACT_ROOT || resolve(import.meta.dirname, '../../../..')
  const composeArgs = [
    '-f',
    `${root}/docker-compose.test.yaml`,
  ]
  execSync(`docker compose ${composeArgs.join(' ')} down --volumes --remove-orphans`, {
    stdio: 'inherit',
    timeout: 30000
  })
  execSync(`docker compose ${composeArgs.join(' ')} build api`, {
    stdio: 'inherit',
    timeout: 300000,
    env: {
      ...process.env,
      // Pass linked package paths through (set via LINKED_* env vars or defaults to .docker/empty)
    }
  })
  console.log('[global-setup] Starting test stack…')
  execSync(`docker compose ${composeArgs.join(' ')} up -d --wait`, {
    stdio: 'inherit',
    timeout: 60000
  })
  console.log('[global-setup] Stack ready.')
}
