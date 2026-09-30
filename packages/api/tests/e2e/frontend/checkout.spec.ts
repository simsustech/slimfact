/**
 * `/checkout` must render something, and the success copy must be spelled
 * correctly.
 *
 * Seam: the browser — visit the two URLs a customer can reach and read the page.
 *
 * `CheckoutPage.vue` is a bare `<router-view>`, and `routes.ts` gives the
 * `checkout` route exactly one child (`success`). A direct visit therefore matches
 * the parent with no child and renders nothing at all: the app shell, no `.q-page`,
 * no text. The success copy also says "succesful".
 */
import { expect, test } from '@playwright/test'
import { ADMIN, loginAs, newPage } from './audit-helpers'

test('/checkout renders an empty state and the success copy is correct', async ({
  browser
}) => {
  test.setTimeout(180_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: ADMIN })

  // Direct visit: the parent route with no matching child.
  await page.goto('/checkout')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.q-page')).toHaveCount(1, { timeout: 30_000 })
  await expect(page.getByText('Nothing to pay here.')).toBeVisible()
  // …and the fallback must offer a way out of the dead end. Asserted by its
  // label, not by role: a q-btn with `to` renders as an anchor.
  await expect(page.getByText('Go to home page')).toBeVisible()

  // The real child route still renders its own page.
  await page.goto('/checkout/success')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.q-page')).toHaveCount(1, { timeout: 30_000 })
  await expect(page.getByText(/successful/)).toBeVisible()
  await expect(page.getByText(/succesful/)).toHaveCount(0)

  await context.close()
})
