import { test, expect, type Locator, type Page } from '@playwright/test'
import { login } from './setup'
import { getTestDb } from './helpers'
import type { Kysely } from 'kysely'
import type { DB } from '../../src/kysely/types.js'

import { ADMIN_EMAIL as email, ADMIN_PASSWORD as password } from './helpers'

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getDb = getTestDb

/** The suggestions-table row for one seeded credit, located by its note. */
const row = (page: Page, text: string) =>
  page.locator('tbody tr').filter({ hasText: text }).first()

/** Rows containing `text` as a whole word — excludes substring collisions
 * like 2026-1 vs 2026-14. */
const exactRow = (page: Page, text: string) =>
  page
    .locator('tbody tr')
    .filter({ hasText: new RegExp(`${escapeRegExp(text)}\\b`) })

const openSuggestions = async (browser: any) => {
  const page = await browser.newPage({ bypassCSP: true })
  await login({ page, email, password })
  await page.goto('/admin/payments?tab=suggestions')
  await page.waitForLoadState('networkidle')
  return page
}

const linkRow = async (page: Page, note: string) => {
  const target = row(page, note)
  const linkBtn = target.locator('[aria-label="Link"], .i-mdi-link').first()
  await expect(linkBtn).toBeVisible({ timeout: 15_000 })
  await linkBtn.click()
  const dialog = page.locator('.q-dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

const confirm = async (dialog: Locator) => {
  await dialog.locator('button[type="submit"]').first().click()
}

const seededInvoiceId = async (db: Kysely<DB>, number: number) => {
  const row = await db
    .selectFrom('checkout.invoices')
    .select('id')
    .where('numberPrefix', '=', '2026-')
    .where('number', '=', number)
    .executeTakeFirstOrThrow()
  return row.id
}

const invoiceStatus = async (db: Kysely<DB>, invoiceId: number) =>
  (
    await db
      .selectFrom('checkout.invoices')
      .select('status')
      .where('id', '=', invoiceId)
      .executeTakeFirst()
  )?.status

/**
 * Suggestions tab (seeded demo): actionable unlinked credits live on
 * /admin/payments?tab=suggestions with a single-select link dialog.
 *
 * Engine gates: bookingDate >= dueDate + amount <= due. The seeded credits
 * are booked the day BEFORE their target invoices are due, so only the
 * adoption path (paid-invoice, no date gate) survives: seed-credit-003
 * (€30, FACTUUR 2026-2) adopts invoice B, which carries a €30 paid
 * manual banktransfer payment. All other seed credits are excluded by the
 * date guard. Runs serially — linking mutates the demo world.
 */
test.describe('payments suggestions tab + link dialog (seeded demo)', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120_000)

  test('suggestions tab shows the adoptable credit with a chip + link', async ({
    browser
  }) => {
    const page = await openSuggestions(browser)
    await expect(page).toHaveURL(/tab=suggestions/)

    // The Suggestions page tab is active.
    await expect(
      page.locator('.q-tabs .q-tab--active').filter({ hasText: 'Suggestions' })
    ).toBeVisible()

    // seed-credit-003 (FACTUUR 2026-2, €30) is the adoption suggestion.
    const creditRow = row(page, 'FACTUUR 2026-2')
    await expect(creditRow).toBeVisible({ timeout: 15_000 })
    await expect(
      creditRow.locator('[data-testid="suggestion-chip"]')
    ).toBeVisible()
    await expect(
      creditRow.locator('[data-testid="suggestion-link"]')
    ).toBeVisible()

    // Pre-due-date credits are excluded by the date guard, not shown.
    await expect(exactRow(page, 'FACTUUR 2026-1')).toHaveCount(0)

    // Recognized payouts and the debit are never suggestions.
    await expect(row(page, 'MOLLIE PAYOUT')).toHaveCount(0)
    await expect(row(page, 'MOLLIE SETTLEMENT 201')).toHaveCount(0)
    await expect(row(page, 'Supermarkt')).toHaveCount(0)
  })

  test('single-select dialog preselects the adoption target and links it', async ({
    browser
  }) => {
    const page = await openSuggestions(browser)
    const db = getDb()
    try {
      const invoiceB = await seededInvoiceId(db, 2)

      const dialog = await linkRow(page, 'FACTUUR 2026-2')
      // Single-select dialog: the adoptable paid invoice is present and
      // selected (checkbox), with the adopt explanatory note.
      await expect(
        dialog.locator('[data-testid="invoice-select"]').first()
      ).toBeVisible({ timeout: 15_000 })
      // The top suggestion (paid invoice B) is auto-selected.
      const bItem = dialog
        .locator('.q-list > .q-item')
        .filter({ hasText: '2026-2' })
        .first()
      await expect(
        bItem.locator('[data-testid="invoice-select"]').first()
      ).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 })
      // Adoptable paid invoices carry the adopt badge.
      await expect(bItem.getByText('Adopt').first()).toBeVisible()
      // Each candidate shows its match-confidence score badge.
      await expect(
        bItem.locator('[data-testid="invoice-score"]').first()
      ).toBeVisible()

      await confirm(dialog)

      // The adopt flow couples the credit to invoice B's existing manual
      // payment (bank:seed-credit-003 reference) and keeps it paid.
      await expect
        .poll(async () => invoiceStatus(db, invoiceB), {
          timeout: 30_000,
          intervals: [1000]
        })
        .toBe('paid')
      // The adopt write sets the credit ref on invoice B's manual payment.
      await expect
        .poll(
          async () => {
            const rows = await db
              .selectFrom('checkout.payments')
              .select('transactionReference')
              .where('invoiceId', '=', invoiceB)
              .execute()
            return rows.some(
              (p) => p.transactionReference === 'bank:seed-credit-003'
            )
          },
          {
            timeout: 30_000,
            intervals: [1000]
          }
        )
        .toBe(true)
    } finally {
      await db.destroy()
    }
  })

  test('after adoption the credit leaves the suggestions list', async ({
    browser
  }) => {
    const page = await openSuggestions(browser)
    // seed-credit-003 was adopted by the second test → not actionable anymore.
    await expect(row(page, 'FACTUUR 2026-2')).toHaveCount(0)
  })

  test('multi-candidate dialog sorts by score and preselects the ref-hit row', async ({
    browser
  }) => {
    const page = await openSuggestions(browser)
    // seed-credit-011 (€130, Jane Doe, note "FACTUUR 2026-14") has two
    // adoptable paid invoices: 2026-14 (explicit ref → 98%) and 2026-13
    // (surname-only tie → 75%). The dialog must list 2026-14 first, checked.
    const creditRow = row(page, 'FACTUUR 2026-14')
    await expect(creditRow).toBeVisible({ timeout: 15_000 })
    const dialog = await linkRow(page, 'FACTUUR 2026-14')

    // Invoice header rows carry the select checkbox; the two adoptable paid
    // invoices (2026-14 ref-hit, 2026-13 surname-tie) sort first by score.
    const invoiceRows = dialog.locator(
      '.q-list > .q-item:has([data-testid="invoice-select"])'
    )
    await expect(invoiceRows.nth(0)).toContainText('2026-14')
    await expect(
      invoiceRows.nth(0).locator('[data-testid="invoice-score"]')
    ).toHaveText('98%')
    await expect(
      invoiceRows.nth(0).locator('[data-testid="invoice-select"]')
    ).toHaveAttribute('aria-checked', 'true')

    const secondItem = invoiceRows.nth(1)
    await expect(secondItem).toContainText('2026-13')
    await expect(
      secondItem.locator('[data-testid="invoice-score"]')
    ).toHaveText('75%')
    await expect(
      secondItem.locator('[data-testid="invoice-select"]')
    ).toHaveAttribute('aria-checked', 'false')
  })
})
