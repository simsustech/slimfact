import { test, expect } from '@playwright/test'
import { login } from './setup'
import {
  mkInvoice,
  ADMIN_EMAIL as email,
  ADMIN_PASSWORD as password
} from './helpers'

test.describe('i-mdi icon audit', () => {
  test('exports page date inputs render i-mdi-calendar / i-mdi-close', async ({
    browser
  }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    await page.goto('/admin/settings/exports')
    await page.waitForLoadState('networkidle')

    // DateInput renders icons.clear + icons.event inside .date-input-field.
    await expect(page.locator('.date-input-field .i-mdi-calendar')).toHaveCount(
      2
    )
    await expect(page.locator('.date-input-field .i-mdi-close')).toHaveCount(2)
    await expect(page.locator('.date-input-field .i-mdi-event')).toHaveCount(0)
    await expect(page.locator('.date-input-field .i-mdi-clear')).toHaveCount(0)
  })

  test('subscription form date inputs render i-mdi-calendar / i-mdi-close', async ({
    browser
  }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    await page.goto('/admin/subscriptions')
    await page.waitForLoadState('networkidle')

    // Open the create dialog — it mounts SubscriptionForm with two DateInputs.
    await page.locator('#fabAdd').click({ force: true })
    const dialog = page.locator('.q-dialog').first()
    await dialog.waitFor({ state: 'visible', timeout: 10_000 })

    await expect(
      dialog.locator('.date-input-field .i-mdi-calendar')
    ).toHaveCount(2)
    await expect(dialog.locator('.date-input-field .i-mdi-close')).toHaveCount(
      2
    )
    await expect(dialog.locator('.date-input-field .i-mdi-event')).toHaveCount(
      0
    )
    await expect(dialog.locator('.date-input-field .i-mdi-clear')).toHaveCount(
      0
    )
  })

  test('customer invoice page payment menu renders i-mdi-bank-transfer', async ({
    browser
  }) => {
    // Create an OPEN invoice through the admin UI (mkInvoice sends it), so the
    // test does not depend on demo-world invoice state other specs mutate.
    const admin = await browser.newPage({ bypassCSP: true })
    await login({ page: admin, email, password })
    const uuid = await mkInvoice(admin)
    await admin.close()

    const page = await browser.newPage({ bypassCSP: true })
    await page.goto(`/invoice/${uuid}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /pay/i }).click()
    await expect(page.locator('.i-mdi-bank-transfer')).toBeVisible()
    await expect(page.locator('.i-fa6-solid-money-bill-transfer')).toHaveCount(
      0
    )
  })
})
