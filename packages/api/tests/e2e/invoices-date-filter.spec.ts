import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  mkInvoice,
  mkBill,
  moreBtn,
  fillComboboxes,
  clickLinesAdd
} from './helpers'

const email = 'admin@slimfact.app'
const password = 'Sif5uEG5hcTH'

const login = async (page: Page) => {
  await page.goto('/')
  await page.click('text=Login')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/.*login/)
  await page.locator('text="Email"').fill(email)
  await page.locator('text="Password"').fill(password)
  await page.locator('button >> text=Login').click()
  await page.waitForURL(/.*user/)
}

// The effective document date used for the date filter is
// COALESCE(date, created_at). Both sides are UTC: openInvoice writes
// `new Date().toISOString().slice(0, 10)` and created_at defaults to
// CURRENT_TIMESTAMP in the UTC container, so "today" must be computed in UTC.
const today = () => new Date().toISOString().slice(0, 10)

// A range that can never match any seeded or freshly created document.
const PAST_RANGE = 'startDate=2020-01-01&endDate=2020-01-31'

// Create an invoice via the form but do NOT send it → stays CONCEPT with
// `date` NULL (only openInvoice sets the bookkeeping date).
const createConceptInvoice = async (page: Page) => {
  await page.goto('/admin/invoices')
  await page.waitForLoadState('networkidle')
  await page.locator('#fabAdd').click({ force: true })
  await fillComboboxes(page)
  await clickLinesAdd(page)
  await page.getByRole('textbox', { name: 'Description' }).fill('E2E concept')
  const unitPrice = page.getByRole('spinbutton', { name: 'Unit price' }).first()
  await unitPrice.evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set
    setter?.call(el, '50.00')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('€50.00').first()).toBeVisible({ timeout: 10000 })
  await page.goto('/admin/invoices')
  await page.waitForLoadState('networkidle')
}

test.describe('Invoice / bill / receipt date filter', () => {
  test.setTimeout(120000)

  test('invoices: URL startDate/endDate filter on the bookkeeping date', async ({
    browser
  }) => {
    const page = await browser.newPage()
    try {
      await login(page)
      // mkInvoice sends the invoice → openInvoice sets `date` = today
      const uuid = await mkInvoice(page)
      expect(uuid).toBeTruthy()

      const t = today()
      await page.goto(`/admin/invoices?startDate=${t}&endDate=${t}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('€50.00').first()).toBeVisible()

      // A range that matches nothing → the empty state (params are honored).
      await page.goto(`/admin/invoices?${PAST_RANGE}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('No results available.')).toBeVisible()
    } finally {
      await page.close()
    }
  })

  test('invoices: undated concept matches via the created_at fallback', async ({
    browser
  }) => {
    const page = await browser.newPage()
    try {
      await login(page)
      await createConceptInvoice(page)

      const t = today()
      await page.goto(`/admin/invoices?startDate=${t}&endDate=${t}`)
      await page.waitForLoadState('networkidle')
      // `date` is NULL for a concept invoice — only the created_at fallback
      // can match it. A date-only filter would drop it.
      await expect(page.getByText('€50.00').first()).toBeVisible()

      await page.goto(`/admin/invoices?${PAST_RANGE}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('No results available.')).toBeVisible()
    } finally {
      await page.close()
    }
  })

  test('bills: URL startDate/endDate filter on created_at; inverted range is empty', async ({
    browser
  }) => {
    const page = await browser.newPage()
    try {
      await login(page)
      // mkBill creates an undated bill → created_at = today
      const uuid = await mkBill(page)
      expect(uuid).toBeTruthy()

      const t = today()
      await page.goto(`/admin/bills?startDate=${t}&endDate=${t}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('€50.00').first()).toBeVisible()

      await page.goto(`/admin/bills?${PAST_RANGE}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('No results available.')).toBeVisible()

      // startDate > endDate → empty result, no error (no row can satisfy both).
      await page.goto('/admin/bills?startDate=2030-01-01&endDate=2020-01-01')
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('No results available.')).toBeVisible()
    } finally {
      await page.close()
    }
  })

  test('receipts: bill converted to receipt appears under its created_at date', async ({
    browser
  }) => {
    const page = await browser.newPage()
    try {
      await login(page)
      const uuid = await mkBill(page)
      expect(uuid).toBeTruthy()

      // Pay the full bill in cash (admin POS flow)
      await page.goto('/admin/bills')
      await page.waitForLoadState('networkidle')
      await page
        .locator('.q-expansion-item__toggle-icon')
        .first()
        .click({ force: true })
      await page
        .locator('.q-expansion-item__content')
        .first()
        .waitFor({ state: 'visible', timeout: 5000 })
      await moreBtn(page)
      await page.getByText('Add payment').first().click()
      await page.getByText('Cash').first().click({ force: true })
      const fillTotalButton = page
        .locator('.q-dialog button i[class*="mdi-dollar"]')
        .first()
      if (await fillTotalButton.isVisible()) await fillTotalButton.click()
      await page.locator('.q-dialog button:has-text("OK")').click()
      await page
        .locator('.q-notification, .q-banner')
        .first()
        .waitFor({ state: 'visible', timeout: 10000 })
        .catch(() => {})

      // Send the receipt → bill becomes RECEIPT (created_at is preserved)
      await moreBtn(page)
      const sendReceiptItem = page.getByText('Send receipt').first()
      await expect(sendReceiptItem).toBeVisible({ timeout: 5000 })
      await sendReceiptItem.click()
      const emailDialog = page.getByRole('dialog').first()
      await emailDialog.waitFor({ state: 'visible', timeout: 5000 })
      await emailDialog.locator('input[type="text"]').first().fill('Receipt')
      const emailBody = emailDialog.locator('textarea').first()
      if (await emailBody.isVisible()) await emailBody.fill('.')
      await emailDialog.getByRole('button', { name: 'Send' }).click()
      await page
        .locator('.q-notification, .q-banner')
        .first()
        .waitFor({ state: 'visible', timeout: 10000 })
        .catch(() => {})

      const t = today()
      await page.goto(`/admin/receipts?startDate=${t}&endDate=${t}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('€50.00').first()).toBeVisible()

      await page.goto(`/admin/receipts?${PAST_RANGE}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('No results available.')).toBeVisible()
    } finally {
      await page.close()
    }
  })

  test('invoices: filter menu date inputs filter the list and clear restores it', async ({
    browser
  }) => {
    const page = await browser.newPage()
    try {
      await login(page)
      const uuid = await mkInvoice(page)
      expect(uuid).toBeTruthy()

      await page.goto('/admin/invoices')
      await page.waitForLoadState('networkidle')

      // Open the filter menu (toolbar search button)
      await page
        .locator('.q-toolbar .q-btn')
        .filter({ has: page.locator('.i-mdi-search') })
        .first()
        .click()

      // Two DateInputs in the menu; part inputs render in the DATE_FORMAT
      // order (DD-MM-YYYY by default → day, month, year).
      const startField = page.locator('.date-input-field').first()
      const endField = page.locator('.date-input-field').nth(1)
      await expect(startField).toBeVisible({ timeout: 5000 })
      await expect(endField).toBeVisible()

      // A range that matches nothing → the list empties.
      for (const field of [startField, endField]) {
        const inputs = field.locator('input')
        await inputs.nth(0).pressSequentially('01')
        await inputs.nth(1).pressSequentially('01')
        await inputs.nth(2).pressSequentially('2020')
      }
      await page.keyboard.press('Escape')
      await expect(page.getByText('No results available.')).toBeVisible()

      // Clear (the toolbar clear icon) → the full list is back.
      await page.locator('.q-toolbar .q-btn i.i-mdi-remove').first().click()
      await expect(page.getByText('€50.00').first()).toBeVisible()
    } finally {
      await page.close()
    }
  })
})
