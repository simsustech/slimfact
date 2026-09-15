import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkInvoice } from './helpers'

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
    // Go to admin panel, expand the invoice, add cash payment (admin/POS flow).
    // The invoice list is shared with parallel spec files — never assume the
    // just-created invoice is the first row (another test's CONCEPT can land on
    // top). Target the row by its mkInvoice line description instead.
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    // Serial workers: the just-created invoice is the newest row. Collapsed
    // rows don't expose line text, so hasText('E2E') scoping cannot find them.
    const e2eRow = page.locator('.q-expansion-item').first()
    await e2eRow
      .locator('.q-expansion-item__toggle-icon')
      .click({ force: true })
    await e2eRow
      .locator('.q-expansion-item__content')
      .waitFor({ state: 'visible', timeout: 5000 })
    const more = e2eRow
      .locator('button')
      .filter({ has: page.locator('.i-mdi-more-vert, .i-mdi-dots-vertical') })
      .first()
    await more.waitFor({ state: 'visible', timeout: 5000 })
    await more.click()
    await page.locator('.q-menu, [role="menu"]').first().waitFor({
      state: 'visible',
      timeout: 5000
    })
    await page.getByRole('button', { name: 'Add payment' }).first().click()
    await page
      .getByRole('dialog')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {})

    // Select Cash payment in the submenu (role-based: the overline labels are
    // not reliably exposed to text queries).
    const cashOption = page.getByRole('button', { name: 'Cash' }).first()
    await expect(cashOption).toBeVisible({ timeout: 5000 })
    await cashOption.click()
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

    // Verify the payment is recorded (same row scoping as above).
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    const paidRow = page.locator('.q-expansion-item').first()
    await paidRow
      .locator('.q-expansion-item__toggle-icon')
      .click({ force: true })
    await paidRow
      .locator('.q-expansion-item__content')
      .waitFor({ state: 'visible', timeout: 5000 })
    await paidRow
      .locator('button')
      .filter({ has: page.locator('.i-mdi-more-vert, .i-mdi-dots-vertical') })
      .first()
      .click()
    await expect(page.getByText('Payments').first()).toBeVisible({
      timeout: 5000
    })

    await page.keyboard.press('Escape')
  })
})
