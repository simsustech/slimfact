import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const email = 'admin@slimfact.app'
const password = 'Sif5uEG5hcTH'

let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()

  await page.goto('/')

  await page.click('text=Login')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveURL(/.*login/)

  await page.locator('text="Email"').fill(email)
  await page.locator('text="Password"').fill(password)

  await page.locator('button').getByText('Login', { exact: true }).click()

  await page.waitForURL(/.*user/)
  // await expect(
  //   page.getByText('Administrator').locator(':scope.q-item__label')
  // ).toBeVisible()
})

test.describe('Administrator', async () => {
  test('Companies', async () => {
    await page.goto('/admin/companies')
  })
})
