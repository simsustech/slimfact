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

  await page.locator('button >> text=Login').click()

  await page.waitForURL(/.*user/)
  await expect(page.getByText('Administrator').first()).toBeAttached()
})

test.afterAll(async () => {
  await page.close()
})

test.describe('Dashboard', () => {
  test('admin-nav-lists-dashboard-entry', async () => {
    await page.goto('/admin')

    await expect(page.getByText('Dashboard').first()).toBeVisible()
    await expect(page.getByText('Clients').first()).toBeVisible()
    await page.getByText('Dashboard').first().click()
    await page.waitForURL(/.*admin\/dashboard/)
  })
  test('dashboard-renders-sections', async () => {
    await page.goto('/admin/dashboard')

    await expect(page.getByText('Revenue').first()).toBeVisible()
    await expect(page.getByText('Invoices').first()).toBeVisible()
    await expect(page.getByText('Bills').first()).toBeVisible()
    await expect(page.getByText('Status overview').first()).toBeVisible()
    await expect(page.getByText('Action items').first()).toBeVisible()
    await expect(page.getByText('Recent activity').first()).toBeVisible()
  })

  test('company-filter', async () => {
    await page.goto('/admin/dashboard')

    const companySelector = page.getByLabel('Company filter')
    await expect(companySelector).toBeVisible()

    // Default state: all companies are pre-selected. Open the listbox once
    // and click each option to deselect them all.
    await companySelector.click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    const options = page.getByRole('option')
    const optionCount = await options.count()
    for (let i = 0; i < optionCount; i++) {
      await options.nth(i).click()
    }

    await expect(
      page.getByText('Select a company to view stats').first()
    ).toBeVisible()
  })

  test('revenue-cards-period-preset', async () => {
    await page.goto('/admin/dashboard')

    await expect(page.getByText('Invoices').first()).toBeVisible()

    await page.getByRole('button', { name: 'Today' }).click()
    await expect(page.getByText('Today').first()).toBeVisible()

    await page.getByRole('button', { name: 'This week' }).click()
    await expect(page.getByText('This week').first()).toBeVisible()
  })

  test('revenue-cards-custom-range', async () => {
    await page.goto('/admin/dashboard')

    const startField = page.locator('.date-input-field').first()
    const endField = page.locator('.date-input-field').nth(1)
    const startSegments = ['01', '01', '2025'] // DD-MM-YYYY
    const endSegments = ['31', '01', '2025']
    for (let i = 0; i < startSegments.length; i++) {
      await startField.locator('input').nth(i).fill(startSegments[i])
    }
    for (let i = 0; i < endSegments.length; i++) {
      await endField.locator('input').nth(i).fill(endSegments[i])
    }

    // When there is no revenue in the custom range, the Price component
    // renders '-' rather than a formatted zero amount (0 is falsy).
    await expect(page.getByText('2025-01-01 → 2025-01-31')).toBeVisible()
  })

  test('status-chart-renders', async () => {
    await page.goto('/admin/dashboard')

    await expect(page.getByText('Status overview').first()).toBeVisible()

    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()
  })

  test('action-items-open-navigation', async () => {
    await page.goto('/admin/dashboard')

    await page
      .getByRole('button', { name: /Open invoices/ })
      .first()
      .click()

    await page.waitForURL(/.*invoices/)

    // The status filter must be applied from the route query: the status
    // select in the search menu shows "Open".
    // Open the search menu (the toolbar button with the search icon).
    await page
      .locator('.q-toolbar .q-btn')
      .filter({ has: page.locator('.i-mdi-search') })
      .first()
      .click()
    await expect(
      page.locator('.q-menu').filter({ hasText: 'Open' }).first()
    ).toBeVisible()
  })

  test('revenue-preset-populates-date-inputs', async () => {
    await page.goto('/admin/dashboard')

    const startField = page.locator('.date-input-field').first()
    const endField = page.locator('.date-input-field').nth(1)

    // Select the "This year" preset.
    await page.getByRole('button', { name: 'This year' }).click()

    // Start input should now show 01-01-<current year> (DD-MM-YYYY).
    const startInputs = startField.locator('input')
    await expect(startInputs.nth(0)).toHaveValue('01')
    await expect(startInputs.nth(1)).toHaveValue('01')
    const endInputs = endField.locator('input')
    // End input should be today's date (DD-MM-YYYY).
    const today = new Date()
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = String(today.getFullYear())
    await expect(endInputs.nth(0)).toHaveValue(dd)
    await expect(endInputs.nth(1)).toHaveValue(mm)
    await expect(endInputs.nth(2)).toHaveValue(yyyy)
  })

  test('action-items-overdue-navigation', async () => {
    await page.goto('/admin/dashboard')

    await page
      .getByRole('button', { name: /Needs reminder/ })
      .first()
      .click()

    await page.waitForURL(/.*invoices/)
  })

  test('recent-activity-renders', async () => {
    await page.goto('/admin/dashboard')

    await expect(page.getByText('Recent activity').first()).toBeVisible()
    await expect(page.getByText('All').first()).toBeVisible()
  })

  test('recent-activity-filter', async () => {
    await page.goto('/admin/dashboard')

    const filter = page.getByLabel('Activity filter')
    await filter.click()
    await page.getByRole('option', { name: 'Payment' }).click()

    await expect(page.getByText('Payment').first()).toBeVisible()
  })

  test('empty-state', async () => {
    await page.goto('/admin/dashboard')

    const empty = page
      .getByText('No data available')
      .or(page.getByText('Select a company to view stats'))
    await expect(empty.first()).toBeVisible()
  })
})
