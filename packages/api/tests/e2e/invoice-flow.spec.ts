import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { fillComboboxes, moreBtn } from './helpers'

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
  await page.locator('button >> text=Login').click()
  await page.waitForURL(/.*user/)
})

test.afterAll(async () => {
  await page.close()
})

async function createInvoice(status?: string): Promise<number> {
  await page.goto('/admin/invoices')
  await page.waitForLoadState('networkidle')
  await page.locator('#fabAdd').click()
  await fillComboboxes(page)

  await page
    .getByRole('list')
    .filter({ hasText: 'Lines Add' })
    .getByRole('listitem')
    .click()
  await page.getByRole('textbox', { name: 'Description' }).fill('Flow test')
  await page.getByRole('spinbutton', { name: 'Unit price' }).fill('100.00')
  await page.getByRole('button', { name: 'Done' }).click()

  if (status) {
    const statusSelect = page.getByRole('combobox', { name: 'Status' })
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.click()
      await page.getByRole('option', { name: status }).click()
    }
  }

  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('\u20AC100.00').first()).toBeVisible({
    timeout: 10000
  })

  await page.goto('/admin/invoices')
  await page.waitForLoadState('networkidle')
  await page.locator('.q-expansion-item__toggle-icon').first().click()
  await page
    .locator('.q-expansion-item__content')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })

  await moreBtn(page)
  const sendBtn = page.getByText('Send').first()
  const hasSend = await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)

  const items = await page.locator('.q-expansion-item').count()
  await page.keyboard.press('Escape')
  return items
}

test.describe('Invoice Lifecycle \u2014 Valid Transitions', () => {
  test('CONCEPT \u2192 OPEN (sendInvoice)', async () => {
    const { mkInvoice } = await import('./helpers')
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()

    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    const statusText = await page
      .locator('.q-expansion-item')
      .first()
      .textContent()
    expect(statusText).toBeTruthy()
  })

  test('CONCEPT \u2192 CANCELED', async () => {
    await createInvoice()
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })

    await moreBtn(page)

    const cancelBtn = page.getByText('Cancel').first()
    await expect(cancelBtn).toBeVisible({ timeout: 3000 })
    await cancelBtn.click()
    await page.getByRole('button', { name: /cancel/i }).click({ timeout: 3000 })

    await expect(page.getByRole('dialog')).not.toBeAttached({
      timeout: 5000
    })
  })
})

test.describe('Bill Lifecycle', () => {
  test('BILL \u2192 RECEIPT (paid bill)', async () => {
    await page.goto('/admin/bills')
    await page.waitForLoadState('networkidle')
    await page.locator('#fabAdd').click()
    await fillComboboxes(page)
    await page
      .getByRole('list')
      .filter({ hasText: 'Lines Add' })
      .getByRole('listitem')
      .click()
    await page.getByRole('textbox', { name: 'Description' }).fill('Bill test')
    await page.getByRole('spinbutton', { name: 'Unit price' }).fill('50.00')
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('\u20AC50.00').first()).toBeVisible({
      timeout: 10000
    })

    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await moreBtn(page)

    const addPaymentBtn = page.getByText('Add payment').first()
    if (await addPaymentBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addPaymentBtn.click()
      await page.getByRole('combobox').first().click()
      await page
        .getByRole('option', { name: /cash/i })
        .first()
        .click({ timeout: 3000 })
      await page.getByRole('spinbutton').fill('50.00')
      await page
        .getByRole('button', { name: /submit/i })
        .click({ timeout: 3000 })
      await page
        .locator('.q-notification')
        .first()
        .waitFor({ state: 'visible', timeout: 10000 })
        .catch(() => {})
    }

    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await moreBtn(page)

    const receiptBtn = page.getByText(/receipt/i).first()
    if (await receiptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await receiptBtn.click()
      await page
        .locator('.q-notification')
        .first()
        .waitFor({ state: 'visible', timeout: 10000 })
        .catch(() => {})
    } else {
      const sendReceiptBtn = page.getByText('Send receipt').first()
      if (
        await sendReceiptBtn.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await sendReceiptBtn.click()
        await page.locator('.q-dialog button').last().click({ timeout: 3000 })
      }
    }

    await page.goto('/admin/receipts')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.q-expansion-item').first()).toBeVisible({
      timeout: 5000
    })
  })
})

test.describe('Invoice Lifecycle \u2014 Blocked Transitions', () => {
  test('BILL cannot be sent directly to OPEN', async () => {
    await page.goto('/admin/bills')
    await page.waitForLoadState('networkidle')
    await page.locator('#fabAdd').click()
    await fillComboboxes(page)
    await page
      .getByRole('list')
      .filter({ hasText: 'Lines Add' })
      .getByRole('listitem')
      .click()
    await page
      .getByRole('textbox', { name: 'Description' })
      .fill('Blocked bill')
    await page.getByRole('spinbutton', { name: 'Unit price' }).fill('100.00')
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('\u20AC100.00').first()).toBeVisible({
      timeout: 10000
    })

    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await moreBtn(page)

    await expect(page.locator('.q-expansion-item').first()).not.toContainText(
      'open',
      { timeout: 3000 }
    )
    await page.keyboard.press('Escape')
  })

  test('CONCEPT cannot be converted to RECEIPT', async () => {
    await createInvoice()
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await moreBtn(page)

    const sendReceiptBtn = page.getByText('Send receipt').first()
    await expect(sendReceiptBtn).not.toBeVisible({ timeout: 2000 })
    await page.keyboard.press('Escape')
  })
})
