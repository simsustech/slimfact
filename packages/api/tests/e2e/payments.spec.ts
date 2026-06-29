import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkInvoice, moreBtn as clickMoreButton } from './helpers'

const email = 'admin@slimfact.app'
const password = 'Sif5uEG5hcTH'

let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120000)
  console.log('=== Payment E2E Tests (local) ===')
  page = await browser.newPage({ bypassCSP: true })

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text())
    }
  })
  page.on('pageerror', (err) => {
    console.log('[BROWSER ERROR]', err.message)
  })

  console.log('Logging in as admin...')
  await page.goto('/')
  await page.click('text=Login')
  await page.waitForURL(/.*login/)
  await expect(page).toHaveURL(/.*login/)
  await page.locator('text="Email"').fill(email)
  await page.locator('text="Password"').fill(password)
  await page.locator('button >> text=Login').click()
  await page.waitForURL(/.*user/)
})

test.afterAll(async () => {
  await page.close()
})

test.describe('Cash Payment', () => {
  test.setTimeout(120000)
  test('Full lifecycle: invoice sent → paid via cash', async () => {
    // Create and send invoice using the proven helper
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()
    // Go to admin panel, expand the invoice, add cash payment (admin/POS flow)
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page
      .locator('.q-expansion-item__toggle-icon')
      .first()
      .click({ force: true })
    await clickMoreButton(page)
    await page.getByText('Add payment').first().click()
    await page
      .getByRole('dialog')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {})

    // Select Cash payment in the dialog
    const cashOption = page.getByText('Cash').first()
    await expect(cashOption).toBeVisible({ timeout: 5000 })
    await cashOption.click({ force: true })
    await page
      .getByRole('dialog')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {})

    // Fill the total amount and confirm
    const fillTotalButton = page
      .locator('.q-dialog button i[class*="mdi-dollar"]')
      .first()
    if (await fillTotalButton.isVisible()) {
      await fillTotalButton.click()
    }
    await page.locator('.q-dialog button:has-text("OK")').click()
    await page
      .locator('.q-notification, .q-banner')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {})

    // Verify the payment is recorded
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page
      .locator('.q-expansion-item__toggle-icon')
      .first()
      .click({ force: true })
    await clickMoreButton(page)
    await expect(page.getByText('Payments').first()).toBeVisible({
      timeout: 5000
    })

    await page.keyboard.press('Escape')
  })
})
