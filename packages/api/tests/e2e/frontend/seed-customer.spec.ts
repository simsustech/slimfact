/**
 * The client-linked account must exist in `seed:test`.
 *
 * Seam: the HTTP/DB boundary — a seeded `/account/*` session. Without an account
 * whose `clients.account_id` points at a client, the API's
 * `findClient({ criteria: { accountId } })` resolves to nothing and every
 * `/account/*` route can only ever render its empty state, so no test (and no
 * audit) can reach those pages.
 *
 * `seed:test` inserts exactly one account (an administrator) and sets no
 * `clients.account_id`, which is what this spec pins.
 */
import { expect, test } from '@playwright/test'
import { CUSTOMER, loginAs, newPage } from './audit-helpers'

// The empty-state strings, per locale: a green run must not be an artefact of
// the session's language.
const EMPTY_STATES = [
  'No results available.',
  'Geen resultaten beschikbaar.',
  'Keine Ergebnisse verfügbar.'
]

test('the seeded client account reads its own invoices', async ({
  browser
}) => {
  test.setTimeout(120_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })

  // Red today without the seed: this login cannot succeed.
  await loginAs({ page, account: CUSTOMER })

  await page.goto('/account/invoices')
  await page.waitForLoadState('networkidle')

  const rows = page.locator('.q-list > .q-item')
  await expect(rows.first()).toBeVisible({ timeout: 30_000 })

  for (const empty of EMPTY_STATES) {
    await expect(page.getByText(empty, { exact: true })).toHaveCount(0)
  }
  expect(await rows.count()).toBeGreaterThan(0)

  await context.close()
})
