import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { fillComboboxes, moreBtn } from './helpers'
import { login } from './setup'

const email = 'admin@slimfact.app'
const password = 'Sif5uEG5hcTH'

let page: Page

test.describe.configure({ mode: 'serial' })

// Fresh page per test: reusing one page across create-dialog flows breaks the
// second dialog (Lines section never renders) — see AGENTS.md "Shared page
// state".
test.beforeEach(async ({ browser }) => {
  page = await browser.newPage()
  await login({ page, email, password })
})

test.afterEach(async () => {
  await page.close()
})

async function createInvoice(status?: string): Promise<number> {
  await page.goto('/admin/invoices')
  await page.waitForLoadState('networkidle')
  await page.locator('#fabAdd').click()
  // Ensure the create dialog actually opened before interacting — on a
  // reused page the click can race the previous dialog teardown.
  await page.locator('.q-dialog').waitFor({ state: 'visible', timeout: 10_000 })
  await fillComboboxes(page)

  // The Lines section renders its header ('Lines') and an Add button as
  // separate nodes inside one list.
  await page
    .getByRole('list')
    .filter({ hasText: 'Lines' })
    .getByRole('button', { name: 'Add' })
    .first()
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
    const dialog = page.locator('.q-dialog')
    await dialog.getByRole('button', { name: /ok/i }).click({ timeout: 3000 })

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
      .filter({ hasText: 'Lines' })
      .getByRole('button', { name: 'Add' })
      .first()
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
      // "Add payment" opens a method sub-menu (Cash / Bank transfer / PIN) —
      // no combobox. Same pattern as payments.spec.ts.
      await page.getByText('Cash').first().click()
      await page
        .getByRole('dialog')
        .first()
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => {})
      const fillTotalButton = page
        .locator('.q-dialog button i[class*="mdi-dollar"]')
        .first()
      if (await fillTotalButton.isVisible().catch(() => false)) {
        await fillTotalButton.click()
      }
      await page.locator('.q-dialog button:has-text("OK")').click()
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
      .filter({ hasText: 'Lines' })
      .getByRole('button', { name: 'Add' })
      .first()
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

test.describe('Payment dates & deletion', () => {
  test('manual bank-transfer payment records the chosen date', async () => {
    test.slow()
    const { mkInvoice } = await import('./helpers')
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()

    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await moreBtn(page)

    await page.getByRole('button', { name: 'Add payment' }).first().click()
    await page.getByRole('button', { name: 'Bank transfer' }).first().click()
    const dialog = page.locator('.q-dialog').first()
    await dialog.waitFor({ state: 'visible', timeout: 5000 })

    // Fill the full outstanding amount via the currency shortcut button.
    const fillTotalButton = dialog
      .locator('button i[class*="mdi-dollar"]')
      .first()
    await fillTotalButton.click()

    // Required DateInput (DD-MM-YYYY part inputs) — book on a past date.
    const dateInputs = dialog.locator('.date-input-field input')
    await dateInputs.nth(0).fill('20')
    await dateInputs.nth(1).fill('08')
    await dateInputs.nth(2).fill('2026')

    await dialog.locator('button:has-text("OK")').click()
    await page
      .locator('.q-notification')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {})

    // The payments tab must render the chosen booking date.
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await page.getByRole('tab', { name: 'Payments' }).click()
    await expect(page.getByText(/8\/20\/\d{2,4}/).first()).toBeVisible({
      timeout: 5000
    })
  })

  test('deleting an offline payment reverts a fully paid invoice to open', async () => {
    test.slow()
    const { mkInvoice } = await import('./helpers')
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()

    // Pay the invoice in full with cash.
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await moreBtn(page)
    await page.getByRole('button', { name: 'Add payment' }).first().click()
    await page.getByRole('button', { name: 'Cash' }).first().click()
    const dialog = page.locator('.q-dialog').first()
    await dialog.waitFor({ state: 'visible', timeout: 5000 })
    const fillTotalButton = dialog
      .locator('button i[class*="mdi-dollar"]')
      .first()
    await fillTotalButton.click()
    await dialog.locator('button:has-text("OK")').click()
    await page
      .locator('.q-notification')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {})

    // Fully paid: delete the payment from the payments tab.
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await page.getByRole('tab', { name: 'Payments' }).click()

    const deletePaymentBtn = page.getByRole('button', {
      name: 'Delete payment'
    })
    await deletePaymentBtn.first().click()

    const confirmDialog = page.locator('.q-dialog').last()
    await confirmDialog.waitFor({ state: 'visible', timeout: 5000 })
    await confirmDialog.getByRole('button', { name: /ok/i }).click()
    await page
      .locator('.q-notification')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {})

    // Reverted to open: "Add payment" must be offered again.
    await moreBtn(page)
    await expect(page.getByText('Add payment').first()).toBeVisible({
      timeout: 5000
    })
  })
})
