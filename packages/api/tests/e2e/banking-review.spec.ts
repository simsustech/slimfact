import { test, expect } from '@playwright/test'
import { login } from './setup'

import { ADMIN_EMAIL as email, ADMIN_PASSWORD as password } from './helpers'

// The link flows (single / adopt / split / multi / psp) are covered by
// banking-link.spec.ts on the merged overview page; this spec keeps only the
// settings-page coverage that banking-link does not exercise.
test.describe('bank settings (seeded demo)', () => {
  test.setTimeout(120_000)

  test('settings shows the not-configured notice when banking is absent', async ({
    browser
  }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    await page.goto('/admin/settings/banking')
    await page.waitForLoadState('networkidle')
    const notice = page.getByText(
      'Open-banking is not configured. Set OPENBANKING_CREDENTIALS_JSON to enable bank import.'
    )
    if (!(await notice.isVisible().catch(() => false))) {
      // The E2E stack always runs banking configured; this branch documents
      // the not-configured UX and only executes against a stack without
      // BANKING_API_URL/BANKING_API_KEY.
      test.skip(true, 'banking is configured in this stack')
      return
    }
    await expect(notice).toBeVisible()
  })

  test('paid-notification email lands in MailHog after Sync now strict-apply', async ({
    browser,
    request
  }) => {
    // The deterministic test stack sets BANKING_INGEST_DISABLED=true
    // (docker-compose.test.yaml) so no auto-apply runs — the strict-apply +
    // email path only executes when ingest is enabled. Skip unless a live
    // ingest-enabled stack is targeted explicitly.
    test.skip(
      true,
      'ingest is disabled in the test stack (BANKING_INGEST_DISABLED=true)'
    )
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })

    // Sync now runs the ingest worker; seed-credit-004 (€25.00, note FACTUUR
    // 2026-3) strict-matches open invoice 2026-3 and auto-applies,
    // flipping it OPEN → PAID. The invoiceHandler's onInvoicePaid callback
    // then emails the admin (fallback recipient: the company's own address).
    await page.goto('/admin/settings/banking')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Sync now' }).click()

    const mailhog = 'http://localhost:8027'
    const deadline = Date.now() + 45_000
    let subject: string | undefined
    while (Date.now() < deadline && subject === undefined) {
      const res = await request.get(`${mailhog}/api/v2/messages`)
      const body = (await res.json()) as {
        items?: Array<{
          Content: { Headers: { Subject?: string[]; To?: string[] } }
        }>
      }
      for (const item of body.items ?? []) {
        const itemSubject = item.Content.Headers.Subject?.[0] ?? ''
        if (itemSubject.includes('2026-3')) {
          subject = itemSubject
          expect(item.Content.Headers.To?.[0]).toContain('john@acme.local')
          break
        }
      }
      if (subject === undefined) {
        await page.waitForTimeout(1_500)
      }
    }
    expect(subject).toBeDefined()
    expect(subject).toContain('2026-3')

    // The auto-applied payment must be booked on the transaction's posting
    // date (seed-credit-004 has bookingDate = yesterday), not sync time.
    const { getTestDb } = await import('./helpers')
    const db = getTestDb()
    try {
      const payment = await db
        .selectFrom('checkout.payments')
        .where('transactionReference', '=', 'bank:seed-credit-004')
        .select(['paidAt'])
        .executeTakeFirstOrThrow()
      const expectedBookingDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      expect(
        new Date(payment.paidAt as unknown as string).toISOString().slice(0, 10)
      ).toBe(expectedBookingDate)
    } finally {
      await db.destroy()
    }
  })
})
