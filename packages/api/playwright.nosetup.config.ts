import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for running E2E tests against an already-running test
 * stack (typically started manually via `docker compose -f
 * docker-compose.test.yaml up -d api`). Bypasses the default config's
 * `globalSetup` which would otherwise down+build+up the stack before each
 * run.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    ignoreHTTPSErrors: true,
    headless: true,
    serviceWorkers: 'block',
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://slimfact.localhost'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      }
    }
  ]
})
