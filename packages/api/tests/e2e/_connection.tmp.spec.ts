import { test, expect } from '@playwright/test'
import { login } from './setup'

import { ADMIN_EMAIL as email, ADMIN_PASSWORD as password } from './helpers'

/**
 * Connection validation: proves the open-banking.io credentials actually
 * connect — the proxy lists live connections and the ingest can fetch
 * accounts. Only runs when explicitly requested:
 *
 *   BANKING_TEST_CONNECTION=1 pnpm exec playwright test \
 *     tests/e2e/_connection.tmp.spec.ts --config=playwright.real.config.ts
 *
 * The assertions are structural (statuses/buttons), never real banking data.
 */
test.describe('open-banking.io connection (credentials check)', () => {
  test.skip(
    process.env.BANKING_TEST_CONNECTION !== '1',
    'Set BANKING_TEST_CONNECTION=1 to verify the open-banking.io connection with the real credentials'
  )
  test.setTimeout(120_000)

  test('connects and surfaces live connections + accounts', async ({
    browser
  }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })

    await page.goto('/admin/bank')
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: 'Settings' }).click()
    await page.waitForLoadState('networkidle')

    // The connections banner must list at least one live connection with a
    // status (Active or RequiresReauth are both valid; an empty list means the
    // credentials did not connect).
    await expect(page.getByText(/Active|RequiresReauth/).first()).toBeVisible({
      timeout: 30_000
    })

    // A linked account (auto-linked by IBAN) is present with its Sync-now
    // button.
    await expect(
      page.getByRole('button', { name: /sync now|syncing/i }).first()
    ).toBeVisible({ timeout: 30_000 })
  })
})
