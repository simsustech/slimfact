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
    await expect(page.getByText('Outstanding').first()).toBeVisible()
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

  test('debtors-section-renders', async () => {
    await page.goto('/admin/dashboard')

    const card = page
      .locator('.q-card')
      .filter({ hasText: 'Outstanding' })
      .first()
    await expect(card).toBeVisible()
    // Company rows with amounts should be listed (seed has OPEN invoices).
    await expect(card.locator('.q-item').first()).toBeVisible()
  })

  test('debtors-bills-toggle', async () => {
    await page.goto('/admin/dashboard')

    const card = page
      .locator('.q-card')
      .filter({ hasText: 'Outstanding' })
      .first()
    // Switch to the Bills tab and verify the list re-renders with bill rows.
    await card.getByRole('button', { name: 'Bills' }).first().click()
    await expect(card.locator('.q-item').first()).toBeVisible()
  })

  test('debtors-row-navigates-to-filtered-invoices', async () => {
    await page.goto('/admin/dashboard')

    const card = page
      .locator('.q-card')
      .filter({ hasText: 'Outstanding' })
      .first()
    await card.locator('.q-item').first().click()

    await page.waitForURL(/.*invoices.*companyId=/)
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
    // End input should be Dec 31 of the current year (full-period preset).
    const yyyy = String(new Date().getFullYear())
    await expect(endInputs.nth(0)).toHaveValue('31')
    await expect(endInputs.nth(1)).toHaveValue('12')
    await expect(endInputs.nth(2)).toHaveValue(yyyy)
  })

  test('action-items-overdue-navigation', async () => {
    await page.goto('/admin/dashboard')

    const needsReminder = page
      .getByRole('button', { name: /Needs reminder/ })
      .first()
    await needsReminder.waitFor({ state: 'attached' })
    // force: the action list can re-render while the stats refetch.
    await needsReminder.click({ force: true })

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
    const paymentOption = page.getByRole('option', { name: 'Payment' })
    await paymentOption.waitFor({ state: 'attached' })
    // force: the menu can re-render while the activity feed refetches, which
    // makes the default stability wait time out.
    await paymentOption.click({ force: true })

    await expect(page.getByText('Payment').first()).toBeVisible()

    // Payment entries must show the amount's invoice reference
    // ("for invoice #FACT-..."): the seed guarantees paid payments.
    await expect(page.getByText(/for invoice #/).first()).toBeVisible()
  })

  test('empty-state', async () => {
    await page.goto('/admin/dashboard')

    // Deselect every company via its chip Remove button (re-queried each
    // loop so re-renders from stats refetches can't detach the locator).
    const filter = page.locator('.dashboard-company-filter')
    await expect(filter).toBeVisible()
    const removeButtons = filter.getByRole('button', { name: 'Remove' })
    while ((await removeButtons.count()) > 0) {
      await removeButtons.first().click({ force: true })
      await page.waitForTimeout(150)
    }
    await expect(
      page.getByText('Select a company to view stats').first()
    ).toBeVisible()
  })

  test('revenue-chart-binning-caption', async () => {
    await page.goto('/admin/dashboard')

    // The chart explains how the data is binned. The default month preset
    // spans at most 31 days so the API bins by week (week numbers).
    await expect(page.getByText(/Binned by week/).first()).toBeVisible()

    // Selecting a wide preset (This year) switches to quarterly bins.
    await page.getByRole('button', { name: 'This year' }).click()
    await expect(page.getByText(/Binned by quarter/).first()).toBeVisible()
  })

  test('revenue-chart-complete-axis-week-preset', async () => {
    await page.goto('/admin/dashboard')

    // This week covers 7 days; the axis must show all 7 even for days with
    // no revenue (labels are exposed via data-chart-labels for tests).
    await page.getByRole('button', { name: 'This week' }).click()
    const labels = page.locator('[data-chart-labels]')
    await expect(labels).toHaveAttribute(
      'data-chart-labels',
      /^\d{4}-\d{2}-\d{2}\|/
    )
    const parts = (await labels.getAttribute('data-chart-labels'))!.split('|')
    expect(parts).toHaveLength(7)
  })

  test('revenue-chart-complete-axis-year-quarter', async () => {
    await page.goto('/admin/dashboard')

    // This year is binned into exactly 4 quarters (YYYY-Q1 .. YYYY-Q4).
    await page.getByRole('button', { name: 'This year' }).click()
    const year = new Date().getFullYear()
    const labels = page.locator('[data-chart-labels]')
    await expect(labels).toHaveAttribute(
      'data-chart-labels',
      `${year}-Q1|${year}-Q2|${year}-Q3|${year}-Q4`
    )
    const parts = (await labels.getAttribute('data-chart-labels'))!.split('|')
    expect(parts).toHaveLength(4)
  })

  test('revenue-chart-click-bucket-zooms-to-period', async () => {
    await page.goto('/admin/dashboard')

    // Year view shows Q1..Q4; clicking the first bar zooms into Q1.
    await page.getByRole('button', { name: 'This year' }).click()
    await expect(page.getByText(/Binned by quarter/).first()).toBeVisible()

    const canvas = page.locator('.chart-canvas-wrap canvas')
    await expect(canvas).toBeVisible()
    const box = (await canvas.boundingBox())!
    await canvas.click({
      position: { x: box.width * 0.2, y: box.height * 0.5 },
      force: true
    })

    const year = String(new Date().getFullYear())
    // DateInput renders segmented day/month/year inputs (DD-MM-YYYY).
    const fromInputs = page
      .locator('.date-input-field')
      .first()
      .locator('input')
    const toInputs = page.locator('.date-input-field').nth(1).locator('input')
    await expect(fromInputs.nth(0)).toHaveValue('01') // day
    await expect(fromInputs.nth(1)).toHaveValue('01') // month
    await expect(fromInputs.nth(2)).toHaveValue(year)
    await expect(toInputs.nth(0)).toHaveValue('31')
    await expect(toInputs.nth(1)).toHaveValue('03')
    await expect(toInputs.nth(2)).toHaveValue(year)

    // The zoomed Q1 range (~91 days) is binned by month.
    await expect(page.getByText(/Binned by month/).first()).toBeVisible()
  })

  test('action-items-show-all-buckets', async () => {
    await page.goto('/admin/dashboard')

    // The seed guarantees one OPEN overdue invoice per aging bucket, so all
    // four action items should be present.
    await expect(
      page.getByRole('button', { name: /Needs reminder/ }).first()
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /First reminder sent/ }).first()
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Second reminder sent/ }).first()
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Exhortation/ }).first()
    ).toBeVisible()
  })

  test('revenue-cards-show-receipts', async () => {
    await page.goto('/admin/dashboard')

    await expect(page.getByText('Receipts').first()).toBeVisible()
  })
})
