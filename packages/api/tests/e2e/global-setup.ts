import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

import { CHROMIUM_LAUNCH_ARGS } from './browser-args'
import { E2E_ADMIN, saveAuthState } from './auth-state'

// This file owns the test stack's lifecycle, so a run never pays for it twice:
// the CI workflow only prepares the external `web` network before handing over
// (see .github/workflows/test staging.yaml). The image build is the cold cost
// on a fresh runner, so its budget is deliberately generous.
const BUILD_TIMEOUT_MS = Number(process.env.E2E_BUILD_TIMEOUT_MS ?? 900000)

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
  console.log('[global-setup] Building test stack images…')
  execSync(`docker compose ${composeArgs.join(' ')} build api banking-api`, {
    stdio: 'inherit',
    timeout: BUILD_TIMEOUT_MS,
    env: {
      ...process.env
    }
  })
  console.log('[global-setup] Starting test stack…')
  // --no-build: both images were just built above, so a missing image should
  // fail here instead of rebuilding inside this step's shorter timeout.
  execSync(`docker compose ${composeArgs.join(' ')} up -d --wait --no-build`, {
    stdio: 'inherit',
    timeout: 300000
  })
  console.log('[global-setup] Stack ready.')
  // Log the seeded admin in once and save its storageState, so every test does
  // not repeat the OIDC round-trip. Best-effort: a test falls back to the real
  // login flow when its state file is missing.
  try {
    const browser = await chromium.launch({ args: CHROMIUM_LAUNCH_ARGS })
    try {
      console.log(`[global-setup] Capturing auth state for ${E2E_ADMIN.email}…`)
      await saveAuthState(browser, E2E_ADMIN.email, E2E_ADMIN.password)
    } finally {
      await browser.close()
    }
  } catch (error) {
    console.log('[global-setup] auth-state capture skipped:', error)
  }
}
