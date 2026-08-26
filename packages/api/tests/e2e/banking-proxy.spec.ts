import { test, expect } from '@playwright/test'
import { login } from './setup'
import { getTestDb, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers'
import { sql } from 'kysely'

const email = ADMIN_EMAIL
const password = ADMIN_PASSWORD
const getDb = getTestDb

test.describe('banking proxy contract + settings', () => {
  test.setTimeout(180_000)

  // Asserts the migration contract (local bank tables gone, bank-link index
  // present) and that the settings page renders — NOT a full sync-now flow.
  test('migration contract: local bank tables gone, settings page works', async ({
    browser
  }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    const db = getDb()
    try {
      // Migration-12 contract (read-only): the local bank working-set tables
      // are gone and the bank-link partial unique index exists on
      // checkout.payments.
      const bankTables = await sql<{ table_name: string }>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('bank_transactions', 'bank_accounts')
      `.execute(db)
      expect(bankTables.rows).toEqual([])

      const bankRefIndex = await sql<{ indexname: string }>`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'checkout' AND indexname = 'payments_bank_ref_invoice_unique'
      `.execute(db)
      expect(bankRefIndex.rows).toHaveLength(1)

      // Migration-13 contract (read-only): the bank_link and
      // payments_bank_ref_invoice_unique index exist.
      const invoiceC = await db
        .selectFrom('checkout.invoices')
        .select(['id', 'numberPrefix', 'number'])
        .where('numberPrefix', '=', '2026-000')
        .where('number', '=', 3)
        .executeTakeFirstOrThrow()
      expect(`${invoiceC.numberPrefix}${invoiceC.number}`).toBe('2026-0003')

      // Bank settings page loads cleanly.
      await page.goto('/admin/bank/settings')
      await page.waitForLoadState('networkidle')
      const knabRow = page
        .locator('.q-item')
        .filter({ hasText: 'Knab' })
        .first()
      await expect(knabRow).toBeVisible({ timeout: 10_000 })
    } finally {
      await db.destroy()
    }
  })
})
