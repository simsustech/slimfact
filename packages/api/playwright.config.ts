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
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ]
        }
      },
      testIgnore: [
        'screenshots-*.spec.ts',
        'invoice-flow-guards.spec.ts',
        // Long-running (2h+) Mollie refund settlement test. Excluded from the
        // normal suite; run on demand with INCLUDE_LONGWAIT=1.
        ...(process.env.INCLUDE_LONGWAIT
          ? []
          : ['payments-mollie-refund-settled.spec.ts']),
        // A container is routed to exactly one PSP. Never run the Mollie and
        // Stripe payment specs together — ignore the spec for the PSP whose
        // API key is NOT configured in this environment (MOLLIE_API_KEY /
        // STRIPE_API_KEY). Only when both are set do we run neither (you must
        // pick one explicitly via the file name).
        ...(process.env.MOLLIE_API_KEY && !process.env.STRIPE_API_KEY
          ? ['payments-stripe.spec.ts']
          : []),
        ...(process.env.STRIPE_API_KEY && !process.env.MOLLIE_API_KEY
          ? [
              'payments-mollie.spec.ts',
              'payments-mollie-refund-settled.spec.ts'
            ]
          : []),
        ...(process.env.CI
          ? [
              'payments.spec.ts',
              'payments-mollie.spec.ts',
              'payments-stripe.spec.ts'
            ]
          : [])
      ]
    }
  ]
})
