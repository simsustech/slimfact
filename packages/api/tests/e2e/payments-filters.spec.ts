import { test, expect } from '@playwright/test'
import { login } from './setup'

import { ADMIN_EMAIL as email, ADMIN_PASSWORD as password } from './helpers'

/**
 * Payments page filter UI (PaymentsPage): the filters live in a QMenu opened
 * by a QBtn, the fresh view defaults to this year's paid payments, and a
 * localized summary sentence describes the active filters.
 *
 * Assertions are data-agnostic (they run against whatever ledger the stack
 * has, seeded demo or a real dump) — only the filter chrome + defaults are
 * checked.
 */
test.describe('payments filters', () => {
  test.setTimeout(120_000)

  const openPayments = async ({
    browser,
    path = '/admin/payments'
  }: {
    browser: any
    path?: string
  }): Promise<{ page: any }> => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    return { page }
  }

  const expectedFromDate = (): string => {
    const year = new Date().getFullYear()
    // DATE_FORMAT default is DD-MM-YYYY (zero-padded day/month).
    return `01-01-${year}`
  }

  const summaryLine = (page: any) =>
    page.locator('.text-caption', { hasText: 'Payments' }).first()

  test('fresh view defaults to this year, status paid, with a summary line', async ({
    browser
  }) => {
    const { page } = await openPayments({ browser })

    // Summary sentence (localized; EN default) reflects the applied defaults.
    await expect(summaryLine(page)).toContainText(`from ${expectedFromDate()}`)
    await expect(summaryLine(page)).toContainText("with status 'paid'")

    // The filter QBtn opens a QMenu; the status filter holds the default.
    await page.getByTestId('ledger-filters-btn').click()
    const menu = page.locator('.q-menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByText('paid', { exact: true }).first()).toBeVisible()
  })

  test('filters live in a QMenu and drive the summary', async ({ browser }) => {
    const { page } = await openPayments({ browser })

    const filtersBtn = page.getByTestId('ledger-filters-btn')
    await expect(filtersBtn).toBeVisible()
    await filtersBtn.click()

    const menu = page.locator('.q-menu')
    await expect(menu).toBeVisible()
    // From / To date inputs + the status group are inside the menu.
    await expect(menu.locator('.date-input-field').first()).toBeVisible()
    const statuses = menu.getByRole('combobox', { name: 'Statuses' })
    await expect(statuses).toBeVisible()

    // Add the 'open' status via the listbox → the summary updates.
    await statuses.click()
    const listbox = page.getByRole('listbox').last()
    await expect(listbox).toBeVisible()
    await listbox.getByRole('option', { name: 'open', exact: true }).click()
    await page.keyboard.press('Escape')

    await expect(summaryLine(page)).toContainText("with status 'paid', 'open'")
  })

  test('deep links with explicit filters bypass the defaults', async ({
    browser
  }) => {
    // A URL with an explicit method filter must NOT force status=paid or a
    // from date — the summary reflects exactly the URL-provided filters.
    const { page } = await openPayments({
      browser,
      path: '/admin/payments?method=ideal&q=Mollie%20payout'
    })

    const summary = summaryLine(page)
    await expect(summary).not.toContainText(`from ${expectedFromDate()}`)
    await expect(summary).not.toContainText("'paid'")
  })
})
