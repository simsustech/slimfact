import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

export default async function globalSetup() {
  const root =
    process.env.SLIMFACT_ROOT || resolve(import.meta.dirname, '../../../..')
  const composeArgs = ['-f', `${root}/docker-compose.test.yaml`]
  execSync(
    `docker compose ${composeArgs.join(' ')} down --volumes --remove-orphans`,
    {
      stdio: 'inherit',
      timeout: 30000
    }
  )
  execSync(`docker compose ${composeArgs.join(' ')} build api`, {
    stdio: 'inherit',
    timeout: 300000,
    env: {
      ...process.env
    }
  })
  console.log('[global-setup] Starting test stack…')
  execSync(`docker compose ${composeArgs.join(' ')} up -d --wait`, {
    stdio: 'inherit',
    timeout: 60000
  })
  console.log('[global-setup] Stack ready.')
}
