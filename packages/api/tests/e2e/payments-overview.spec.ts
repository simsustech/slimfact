import { test, expect } from '@playwright/test'
import { login } from './setup'

import { ADMIN_EMAIL as email, ADMIN_PASSWORD as password } from './helpers'

/**
 * Unified payments ledger (/admin/payments) against the seeded demo world.
 * Deterministic fixtures (seed:test): B manual banktransfer payment,
 * E bank-linked + Mollie payout, refund re-seed-001, failed iDEAL +
 * pending creditcard attempts on F, credits seed-credit-001..010
 * (007 "Geen factuurnummer" stays permanently unmatched; debits excluded).
 *
 * This spec never mutates data — the Link dialog is only opened, not applied.
 */
test.describe('payments overview (seeded demo)', () => {
  test.setTimeout(120_000)

  const openLedger = async ({
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

  test('drawer exposes Payments and moves Bank settings under Settings', async ({
    browser
  }) => {
    const { page } = await openLedger({ browser })
    // The drawer starts collapsed (mini variant) — expand it first.
    await page.getByRole('button', { name: 'Menu' }).first().click()
    await expect
      .poll(
        async () => await page.locator('a[href="/admin/payments"]').count(),
        {
          timeout: 10_000
        }
      )
      .toBeGreaterThanOrEqual(1)
    await expect(page.locator('a[href="/admin/settings/banking"]')).toHaveCount(
      1
    )
    // Transition: the old Bank drawer group is gone entirely.
    await expect(page.locator('a[href="/admin/bank/overview"]')).toHaveCount(0)
    await expect(page.locator('a[href="/admin/bank/settings"]')).toHaveCount(0)

    // Dashboard quick menus: Payments listed in the admin menu; the old Bank
    // entry is replaced there, while Settings → Banking exists on the hub.
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Menu' }).first().click()
    await expect
      .poll(
        async () =>
          await page.locator('a[href="/admin/payments"]:visible').count(),
        {
          timeout: 10_000
        }
      )
      .toBeGreaterThanOrEqual(1)
    const adminMenu = page
      .locator('a[href="/admin/payments"]')
      .locator('visible=true')
    await expect(adminMenu.first()).toBeVisible()
  })

  test('renders every seeded row kind in one chronological ledger', async ({
    browser
  }) => {
    // Unmatched credit surfaces as a review row.
    {
      const { page } = await openLedger({
        browser,
        path: '/admin/payments?q=FACTUUR%202026-0008'
      })
      const table = page.locator('table')
      await expect(table.getByText('FACTUUR 2026-0008').first()).toBeVisible()
      await expect(
        table.locator('[data-testid="ledger-needs-review"]').first()
      ).toBeVisible()
    }

    // Debit noise and read-time-recognized payouts never surface as
    // "needs review" rows.
    const assertNoReviewBadge = async (path: string) => {
      const { page } = await openLedger({ browser, path })
      await page.waitForLoadState('networkidle')
      const badges = await page
        .locator('[data-testid="ledger-needs-review"]')
        .count()
      expect(badges).toBe(0)
    }
    await assertNoReviewBadge('/admin/payments?q=Supermarkt')
    await assertNoReviewBadge('/admin/payments?q=MOLLIE%20PAYOUT')
    await assertNoReviewBadge('/admin/payments?q=MOLLIE%20SETTLEMENT')

    // Recognized payments …
    const expectRowVisible = async (path: string, text: string) => {
      const { page } = await openLedger({ browser, path })
      const table = page.locator('table')
      await expect(table.getByText(text).first()).toBeVisible()
    }
    await expectRowVisible(
      '/admin/payments?q=Bank%20transfer%20(manual)',
      'Bank transfer (manual)'
    )
    await expectRowVisible(
      '/admin/payments?q=Mollie%20payout%202026-0012',
      'Mollie payout 2026-0012'
    )
    // Failed + pending attempts …
    await expectRowVisible(
      '/admin/payments?q=attempt%202026-0006',
      'Failed iDEAL attempt 2026-0006'
    )
    await expectRowVisible(
      '/admin/payments?q=attempt%202026-0006',
      'Pending creditcard attempt 2026-0006'
    )

    // Linked credit is represented by its badged payment row only.
    const linked = await openLedger({
      browser,
      path: '/admin/payments?q=Bank%20credit%202026-0005'
    })
    const linkedRow = linked.page
      .locator('tr', { hasText: 'Bank credit 2026-0005' })
      .first()
    await expect(linkedRow).toHaveCount(1)
    await expect(
      linkedRow.locator('[data-testid="ledger-bank-synced"]')
    ).toHaveCount(1)
  })

  test('aggregates header shows totals with refund separated', async ({
    browser
  }) => {
    // Scoped to the one deterministic seeded refund (re-seed-001 = €10.00):
    // the filtered view's totals must reflect exactly that refund.
    const { page } = await openLedger({
      browser,
      path: '/admin/payments?q=Refund%202026-0005'
    })
    await expect(page.getByTestId('agg-refunded')).toContainText('€10.00')
    await expect(page.getByTestId('agg-in')).toContainText('€')
    await expect(page.getByTestId('agg-net')).toContainText('-€')
  })

  test('method filter deep-links, filters, and survives reload', async ({
    browser
  }) => {
    const { page } = await openLedger({
      browser,
      path: '/admin/payments?method=ideal&q=Mollie%20payout%202026-0012'
    })

    const table = page.locator('table')
    await expect(
      table.getByText('Mollie payout 2026-0012').first()
    ).toBeVisible()

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(
      table.getByText('Mollie payout 2026-0012').first()
    ).toBeVisible()
  })

  test('unmatched credit opens the reused Link dialog', async ({ browser }) => {
    const { page } = await openLedger({
      browser,
      path: '/admin/payments?q=FACTUUR%202026-0008'
    })
    const row = page.locator('tr', { hasText: 'FACTUUR 2026-0008' }).first()
    await row.getByRole('button', { name: /link/i }).click()
    await expect(page.locator('.q-dialog').first()).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('invoice label links into the focused invoice list', async ({
    browser
  }) => {
    const { page } = await openLedger({
      browser,
      path: '/admin/payments?q=Bank%20credit%202026-0005'
    })
    await page.locator('a[data-testid="ledger-invoice-link"]').first().click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/uuid=00000000-0000-4000-8000-000000000005/)
  })

  test('CSV export downloads the filtered selection', async ({ browser }) => {
    const { page } = await openLedger({
      browser,
      path: '/admin/payments?q=Mollie%20payout%202026-0012'
    })
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByTestId('ledger-export').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(
      /^slimfact-payments-\d{8}\.csv$/
    )
    const csv = await (
      await import('node:fs/promises')
    )
      .readFile(await download.path(), 'utf-8')
      .then((content) => content.replace(/^\uFEFF/, ''))
    const lines = csv.split(/\r?\n/)
    const header = lines[0]
    const firstRow = lines[1]
    expect(header.split(';')).toEqual([
      'Date',
      'Method',
      'Description',
      'Invoice',
      'Client',
      'Amount',
      'Status',
      'PSP'
    ])
    expect(firstRow).toContain('Mollie payout 2026-0012')
  })
})
