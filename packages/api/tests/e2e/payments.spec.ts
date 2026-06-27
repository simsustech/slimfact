import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { dumpPage, mkInvoice, moreBtn as clickMoreButton } from './helpers'

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

test.describe('Payment Options', () => {
  test.setTimeout(120000)

  test('shows iDEAL payment option on public invoice', async () => {
    const invoiceUuid = await mkInvoice(page)
    expect(invoiceUuid).toBeTruthy()
    await page.goto(`/invoice/${invoiceUuid}`)
    await page.waitForTimeout(3000)

    const payButton = page.getByRole('button', { name: /Pay/ })
    await payButton.click()
    await page.waitForTimeout(300)

    await expect(page.getByText('iDEAL').first()).toBeVisible()
    await expect(page.getByText('Credit card').first()).toBeVisible()
    await expect(page.getByText('Bank transfer').first()).toBeVisible()
  })
})

test.describe('Cash Payment', () => {
  test('Full lifecycle: invoice sent → paid via cash', async () => {
    await page.goto('/admin/invoices')
    await page.waitForTimeout(3000)
    await page.locator('#fabAdd').click()

    await page.getByRole('combobox', { name: 'Company*' }).click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    await page.getByRole('option').first().click()
    await page.getByRole('toolbar').first().click({ force: true })
    await page.waitForTimeout(500)

    await page.getByRole('combobox', { name: 'Client*' }).click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    await page.getByRole('option').first().click()
    await page.getByRole('toolbar').first().click({ force: true })
    await page.waitForTimeout(500)

    // Wait for number prefix options to load before selecting
    await page.getByRole('combobox', { name: 'Number prefix*' }).click()
    await expect(page.getByRole('option').first()).toBeVisible({
      timeout: 10000
    })
    await page.getByRole('option').first().click()

    await page
      .getByRole('list')
      .filter({ hasText: 'Lines Add' })
      .getByRole('listitem')
      .click()
    await page
      .getByRole('textbox', { name: 'Description' })
      .fill('E2E test invoice')
    await page.getByRole('spinbutton', { name: 'Unit price' }).fill('50.00')
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('€50.00').first()).toBeVisible({
      timeout: 10000
    })

    const expandButton = page.locator('.q-expansion-item__toggle-icon').first()
    await expandButton.click({ force: true })
    await page.waitForTimeout(500)
    await clickMoreButton(page)

    const sendOption = page.getByText('Send').first()
    await expect(sendOption).toBeVisible()
    await sendOption.click()
    await page.waitForTimeout(500)

    const subjectInput = page.locator('.q-dialog input[type="text"]').first()
    if (await subjectInput.isVisible()) {
      await subjectInput.fill('Invoice')
    }
    const bodyTextarea = page.locator('.q-dialog textarea').first()
    if (await bodyTextarea.isVisible()) {
      await bodyTextarea.fill('Please find your invoice attached.')
    }
    await page.getByRole('button', { name: 'Send' }).click()
    await page.waitForTimeout(1500)

    await expandButton.click({ force: true })
    await page.waitForTimeout(500)
    await clickMoreButton(page)

    await page.getByText('Add payment').first().click()
    await page.waitForTimeout(500)

    const cashOption = page.getByText('Cash').first()
    await expect(cashOption).toBeVisible({ timeout: 5000 })
    await cashOption.click({ force: true })
    await page.waitForTimeout(500)

    const fillTotalButton = page
      .locator('.q-dialog button i[class*="mdi-dollar"]')
      .first()
    if (await fillTotalButton.isVisible()) {
      await fillTotalButton.click()
    }
    await page.locator('.q-dialog button:has-text("OK")').click()
    await page.waitForTimeout(1500)

    await expandButton.click({ force: true })
    await page.waitForTimeout(500)
    await expect(page.getByText('Payments').first()).toBeVisible({
      timeout: 5000
    })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  })
})
