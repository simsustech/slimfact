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
  test('dashboard-renders-sections', async () => {
    await page.goto('/admin')

    await expect(page.getByText('Revenue').first()).toBeVisible()
    await expect(page.getByText('Invoices').first()).toBeVisible()
    await expect(page.getByText('Bills').first()).toBeVisible()
    await expect(page.getByText('Status overview').first()).toBeVisible()
    await expect(page.getByText('Action items').first()).toBeVisible()
    await expect(page.getByText('Recent activity').first()).toBeVisible()
  })

  test('company-filter', async () => {
    await page.goto('/admin')

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
    await page.goto('/admin')

    await expect(page.getByText('Invoices').first()).toBeVisible()

    await page.getByRole('button', { name: 'Today' }).click()
    await expect(page.getByText('Today').first()).toBeVisible()

    await page.getByRole('button', { name: 'This week' }).click()
    await expect(page.getByText('This week').first()).toBeVisible()
  })

  test('revenue-cards-custom-range', async () => {
    await page.goto('/admin')

    await page.locator('input[type="date"]').first().fill('2025-01-01')
    await page.locator('input[type="date"]').nth(1).fill('2025-01-31')

    // When there is no revenue in the custom range, the Price component
    // renders '-' rather than a formatted zero amount (0 is falsy).
    await expect(page.getByText('2025-01-01 → 2025-01-31')).toBeVisible()
  })

  test('status-chart-renders', async () => {
    await page.goto('/admin')

    await expect(page.getByText('Status overview').first()).toBeVisible()

    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()
  })

  test('action-items-open-navigation', async () => {
    await page.goto('/admin')

    const openItem = page
      .getByRole('listitem')
      .filter({ hasText: 'Open' })
      .first()
    await openItem.click()

    await page.waitForURL(/.*invoices/)
  })

  test('action-items-overdue-navigation', async () => {
    await page.goto('/admin')

    const needsReminder = page
      .getByRole('listitem')
      .filter({ hasText: 'Needs reminder' })
      .first()
    await needsReminder.click()

    await page.waitForURL(/.*invoices/)
  })

  test('recent-activity-renders', async () => {
    await page.goto('/admin')

    await expect(page.getByText('Recent activity').first()).toBeVisible()
    await expect(page.getByText('All').first()).toBeVisible()
  })

  test('recent-activity-filter', async () => {
    await page.goto('/admin')

    const filter = page.getByLabel('Activity filter')
    await filter.click()
    await page.getByRole('option', { name: 'Payment' }).click()

    await expect(page.getByText('Payment').first()).toBeVisible()
  })

  test('empty-state', async () => {
    await page.goto('/admin')

    const empty = page
      .getByText('No data available')
      .or(page.getByText('Select a company to view stats'))
    await expect(empty.first()).toBeVisible()
  })
})
