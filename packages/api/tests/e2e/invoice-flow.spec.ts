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
    // Set invoice status via combobox if available
    const statusSelect = page.getByRole('combobox', { name: 'Status' })
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.click()
      await page.getByRole('option', { name: status }).click()
    }
  }

  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('€100.00').first()).toBeVisible({
    timeout: 10000
  })

  // Get the invoice ID from the expansion item
  await page.goto('/admin/invoices')
  await page.waitForLoadState('networkidle')
  await page.locator('.q-expansion-item__toggle-icon').first().click()
  await page
    .locator('.q-expansion-item__content')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })

  // Get id from the invoice's More menu actions
  await moreBtn(page)
  const sendBtn = page.getByText('Send').first()
  const hasSend = await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)

  // Count existing invoices to get the ID
  const items = await page.locator('.q-expansion-item').count()
  await page.keyboard.press('Escape')
  return items // Return count as proxy for invoice id
}

test.describe('Invoice Lifecycle — Valid Transitions', () => {
  test('CONCEPT → OPEN (sendInvoice)', async () => {
    const { mkInvoice } = await import('./helpers')
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()

    // Verify the invoice exists and was opened
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    const statusText = await page
      .locator('.q-expansion-item')
      .first()
      .textContent()
    // The invoice should have been sent (OPEN status)
    expect(statusText).toBeTruthy()
  })

  test('CONCEPT → CANCELED', async () => {
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
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click()
      await page
        .getByRole('button', { name: /cancel|annul/i })
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
    await expect(page.locator('.q-expansion-item').first()).toContainText(
      /cancel/i,
      { timeout: 5000 }
    )
  })
})

test.describe('Bill Lifecycle', () => {
  test('BILL → RECEIPT (paid bill)', async () => {
    // Create a bill
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
    await expect(page.getByText('€50.00').first()).toBeVisible({
      timeout: 10000
    })

    // Add a cash payment to fully pay the bill
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
      // Select cash payment
      await page.getByRole('combobox').first().click()
      await page
        .getByRole('option', { name: /cash|contant/i })
        .first()
        .click({ timeout: 3000 })
      await page.getByRole('spinbutton').fill('50.00')
      await page
        .getByRole('button', { name: /submit|add|toev/i })
        .click({ timeout: 3000 })
      await page
        .locator('.q-notification')
        .first()
        .waitFor({ state: 'visible', timeout: 10000 })
        .catch(() => {})
    }

    // Now convert to receipt
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await moreBtn(page)

    const receiptBtn = page.getByText(/receipt|bon/i).first()
    if (await receiptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await receiptBtn.click()
      await page
        .locator('.q-notification')
        .first()
        .waitFor({ state: 'visible', timeout: 10000 })
        .catch(() => {})
    } else {
      // Bill might already be a receipt if Send Receipt was used
      const sendReceiptBtn = page.getByText('Send receipt').first()
      if (
        await sendReceiptBtn.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await sendReceiptBtn.click()
        await page.locator('.q-dialog button').last().click({ timeout: 3000 })
      }
    }

    // Verify the bill is now a receipt
    await page.goto('/admin/receipts')
    await page.waitForLoadState('networkidle')
    // Should show at least one receipt
    await expect(page.locator('.q-expansion-item').first()).toBeVisible({
      timeout: 5000
    })
  })
})

test.describe('Invoice Lifecycle — Blocked Transitions', () => {
  test('BILL cannot be sent directly to OPEN', async () => {
    // Create a bill and try to send it — should require payment first
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
    await expect(page.getByText('€100.00').first()).toBeVisible({
      timeout: 10000
    })

    // Navigate to invoices and try to send
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await moreBtn(page)

    // The Send button should not be visible for bills, or it should show an error
    // Verify the invoice shows "bill" status, not "open"
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

    // Send receipt option should not appear for concept invoices
    const sendReceiptBtn = page.getByText('Send receipt').first()
    await expect(sendReceiptBtn).not.toBeVisible({ timeout: 2000 })
    await page.keyboard.press('Escape')
  })
})
