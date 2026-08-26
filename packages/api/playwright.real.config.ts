import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config.js'

export default defineConfig({
  ...base,
  globalSetup: undefined,
  projects: [
    {
      ...base.projects!.find((p) => p.name === 'chromium')!,
      testIgnore: []
    }
  ],
  use: {
    ...base.use,
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
    headless: true,
    serviceWorkers: 'block',
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://slimfact.localhost'
  }
})
