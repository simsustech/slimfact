import { defineConfig, devices } from '@playwright/test'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
    headless: !!process.env.CI,
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
      },
      testIgnore: process.env.CI
        ? [
            'payments.spec.ts',
            'payments-mollie.spec.ts',
            'payments-stripe.spec.ts'
          ]
        : undefined
    }
  ]
})
