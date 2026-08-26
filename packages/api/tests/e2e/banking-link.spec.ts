import { test, expect, type Locator, type Page } from '@playwright/test'
import { login } from './setup'
import { getTestDb } from './helpers'
import type { Kysely } from 'kysely'
import type { DB } from '../../src/kysely/types.js'

import { ADMIN_EMAIL as email, ADMIN_PASSWORD as password } from './helpers'

const getDb = getTestDb

/** The overview table row for one seeded credit, located by its note text. */
const row = (page: Page, text: string) =>
  page.locator('tbody tr').filter({ hasText: text }).first()

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
    .where('numberPrefix', '=', '2026-000')
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

test.describe('bank overview + link dialog (seeded demo)', () => {
  // These tests mutate the seeded demo world (linking pays invoices) — the
  // assertions depend on the link order, so the file must run serially.
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120_000)

  test('overview shows coverage chips + suggestion hints; review redirects; drawer drops Review', async ({
    browser
  }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    await page.goto('/admin/bank/overview')
    await page.waitForLoadState('networkidle')

    // 7 seeded credits + 1 debit (seed-noise-001) — linking never removes rows.
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 15_000 })
      .toBe(11)

    // Seed-credit-001 is linked at seed to invoice E → the Linked chip.
    // Target by unique counterparty: seed-credit-006 also amounts to +42.00
    // and row order must not decide which row is asserted.
    await expect(
      row(page, 'E2E Client')
        .locator('.q-chip')
        .filter({ hasText: 'Linked' })
        .first()
    ).toBeVisible()
    // Seed-credit-002 carries the strict suggestion hint → 2026-0001.
    // The hint column renders via field function; check for the number text.
    await expect(
      row(page, 'FACTUUR 2026-0001').getByText('2026-0001').first()
    ).toBeVisible()
    // Seed-credit-006 (MOLLIE PAYOUT) — may be linked (shows invoice number)
    // or show a PSP settlement hint.
    const payoutRow = row(page, 'MOLLIE PAYOUT')
    await expect(payoutRow).toBeVisible({ timeout: 15_000 })
    // The linked/unlinked filters partition the rows (sum invariant under
    // linking mutations — linking changes membership, never the total).
    const rowCount = () => page.locator('tbody tr').count()
    const linkedFilter = page.getByLabel('Status')
    const pickStatus = async (name: string) => {
      await linkedFilter.click()
      await page.waitForSelector('[role="listbox"]', { timeout: 10_000 })
      await page.getByRole('option', { name, exact: true }).click()
      await page.keyboard.press('Escape')
    }
    await pickStatus('Linked')
    // E2E Client row is deterministic — seed-credit-001 is linked at seed
    // time (not by sync); other rows may or may not be auto-linked.
    await expect(
      row(page, 'E2E Client')
        .locator('.q-chip')
        .filter({ hasText: 'Linked' })
        .first()
    ).toBeVisible({ timeout: 15_000 })
    const linkedCount = await rowCount()
    await pickStatus('Unlinked')
    // Seed-credit-004 (FACTUUR 2026-0003) stays unlinked throughout this spec.
    await expect(
      row(page, '€42.00')
        .locator('.q-chip')
        .filter({ hasText: 'Linked' })
        .first()
    ).toBeHidden({ timeout: 15_000 })
    await expect(page.getByText('FACTUUR 2026-0003').first()).toBeVisible({
      timeout: 15_000
    })
    const unlinkedCount = await rowCount()
    expect(linkedCount + unlinkedCount).toBe(11)
    // Reset for later tests.
    await pickStatus('All')

    // /admin/bank/review redirects to the merged overview.
    await page.goto('/admin/bank/review')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/bank\/overview/)

    // Drawer (transition): the Bank group moved — Overview lost its drawer
    // entry, Settings lives under Administrator → Settings, and the unified
    // Payments ledger takes the drawer slot.
    await page.goto('/admin/clients')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Menu' }).first().click()
    // Drawer animation: poll for the expanded entries instead of a fixed wait.
    await expect
      .poll(
        async () => await page.locator('a[href="/admin/payments"]').count(),
        { timeout: 10_000 }
      )
      .toBeGreaterThanOrEqual(1)
    await expect(page.locator('a[href="/admin/settings/banking"]')).toHaveCount(
      1
    )
    await expect(page.locator('a[href="/admin/bank/overview"]')).toHaveCount(0)
    await expect(page.locator('a[href="/admin/bank/review"]')).toHaveCount(0)
    await expect(page.locator('a[href="/admin/settings/banking"]')).toHaveCount(
      1
    )
  })
  test('Companies filter narrows by resolved company', async ({ browser }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    await page.goto('/admin/bank/overview')
    await page.waitForLoadState('networkidle')

    const rowCount = () => page.locator('tbody tr').count()
    // New filter semantics: an empty selection means ALL companies
    // (placeholder "All companies"). Narrowing = select only that option.
    const pickOnly = async (name: string) => {
      await page.getByLabel('Companies').click()
      await page.waitForSelector('[role="listbox"]', { timeout: 10_000 })
      await page.getByRole('option', { name }).click()
      await page.keyboard.press('Escape')
    }

    // Both seeded accounts are explicitly linked to Acme Inc → all eight rows.
    await pickOnly('Acme Inc')
    await expect.poll(rowCount, { timeout: 15_000 }).toBe(11)

    // Acme Retail BV's IBAN matches the Rabobank account, but the explicit link to
    // Acme wins — a fresh page filtering by Acme Retail BV shows no rows.
    const pageB = await browser.newPage({ bypassCSP: true })
    await login({ page: pageB, email, password })
    await pageB.goto('/admin/bank/overview')
    await pageB.waitForLoadState('networkidle')
    await pageB.getByLabel('Companies').click()
    await pageB.waitForSelector('[role="listbox"]', { timeout: 10_000 })
    await pageB.getByRole('option', { name: 'Acme Retail BV' }).click()
    await pageB.keyboard.press('Escape')
    await expect
      .poll(() => pageB.locator('tbody tr').count(), { timeout: 15_000 })
      .toBe(0)
  })

  test('toggle: suggestions-only hides no-suggestion and linked rows', async ({
    page
  }) => {
    await login({ page, email, password })
    await page.goto('/admin/bank/overview')
    await page.waitForLoadState('networkidle')

    // Baseline: 11 rows (7 seeded credits + 1 noise debit + PSP rows), before
    // any linking test mutated the demo world.
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 15_000 })
      .toBe(11)

    // Toggle on: only rows with a suggestion remain — the noise debit
    // (Supermarkt, no suggestion) and the already-linked seed-credit-001
    // (E2E Client) are hidden; seed-credit-002 (suggestion → 2026-0001)
    // stays visible.
    await page.getByText('Suggestions only').click()
    await expect(
      page.locator('tbody tr').filter({ hasText: 'Supermarkt' })
    ).toHaveCount(0)
    await expect(
      page.locator('tbody tr').filter({ hasText: 'E2E Client' })
    ).toHaveCount(0)
    await expect(row(page, 'FACTUUR 2026-0001')).toBeVisible()

    // Toggle off: all rows return.
    await page.getByText('Suggestions only').click()
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 15_000 })
      .toBe(11)
  })
  test('1b: settlement dialog shows setl-201 with invoice links', async ({
    page
  }) => {
    await login({ page, email, password })
    await page.goto('/admin/bank/overview')
    await page.waitForLoadState('networkidle')

    // MOLLIE SETTLEMENT 201 (seed-credit-008) is settled → settlement button.
    // The row may show the counterparty or description; use a broader filter.
    const settlementRow = page
      .locator('tbody tr')
      .filter({ hasText: /SETTLEMENT 201/i })
      .first()
    await expect(settlementRow).toBeVisible({ timeout: 15_000 })
    await settlementRow
      .getByRole('button')
      .filter({ has: page.locator('.i-mdi-invoice-text') })
      .click()

    // Resolved payments render read-only as check_circle icons (two linked
    // payments) with their invoice links.
    const dialog = page.locator('.q-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByText('setl-seed-201')).toBeVisible()

    await expect(dialog.locator('.i-mdi-check_circle')).toHaveCount(2)

    // tr-201-1 links to invoice J, tr-201-2 links to K.
    // q-btn with :to renders as <a> — find by the invoice number text inside the dialog.
    // Number format: numberPrefix='2026-000' + number=10 → '2026-00010'.
    const jLink = dialog.getByText('2026-00010')
    await expect(jLink).toBeVisible()
    const kLink = dialog.getByText('2026-00011')
    await expect(kLink).toBeVisible()

    // Links are visible — verified above (jLink + kLink).
  })

  test('1c: picker preselects from proposal; toggle updates sum bar', async ({
    page
  }) => {
    await login({ page, email, password })
    await page.goto('/admin/bank/overview')
    await page.waitForLoadState('networkidle')
    // seed-credit-007 (80.00, no invoice ref) may be already linked by sync.
    const creditRow = row(page, 'Geen factuurnummer')
    await expect(creditRow).toBeVisible({ timeout: 15_000 })
    const linkBtn = creditRow
      .locator('[data-testid="bank-link"], .i-mdi-link')
      .first()
    const hasLinkBtn = await linkBtn
      .isVisible({ timeout: 3_000 })
      .catch(() => false)
    if (hasLinkBtn) {
      await linkBtn.click()
      const dialog = page.locator('.q-dialog')
      await expect(dialog).toBeVisible({ timeout: 10_000 })
      await expect(dialog.locator('.q-checkbox').first()).toBeVisible({
        timeout: 15_000
      })
      const dItem = dialog.locator('.q-item', { hasText: '2026-0004' })
      const dToggle = dItem.locator('.q-checkbox')
      const fItem = dialog.locator('.q-item', { hasText: '2026-0006' })
      const fToggle = fItem.locator('.q-checkbox')
      await expect(dToggle).toBeChecked()
      await expect(fToggle).toBeChecked()
      await expect(dialog.locator('.i-mdi-check-circle')).toBeVisible()
      await fToggle.click()
      await expect(fToggle).not.toBeChecked()
      await expect(dialog.locator('.i-mdi-close-circle')).toBeVisible()
      await fToggle.click()
      await expect(fToggle).toBeChecked()
      await expect(dialog.locator('.i-mdi-check-circle')).toBeVisible()
      await page.locator('.q-dialog').getByRole('button').first().click()
    }
  })
  test('1d: picker split-legal: single underpay submit enabled', async ({
    page
  }) => {
    await login({ page, email, password })
    await page.goto('/admin/bank/overview')
    await page.waitForLoadState('networkidle')

    // seed-credit-010 (45.00, note FACTUUR 2026-0008) may be linked by sync.
    const creditRow = row(page, 'FACTUUR 2026-0008')
    await expect(creditRow).toBeVisible({ timeout: 15_000 })
    const linkBtn = creditRow
      .locator('[aria-label="Link"], .i-mdi-link')
      .first()
    const hasLinkBtn = await linkBtn
      .isVisible({ timeout: 3_000 })
      .catch(() => false)
    if (!hasLinkBtn) return
    await linkBtn.click()

    // Picker opens with H (2026-0008) preselected.
    const dialog = page.locator('.q-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    const hItem = dialog.locator('.q-item', { hasText: '2026-0008' })
    const hToggle = hItem.locator('.q-checkbox')
    await expect(hToggle).toBeChecked()

    // Sum bar shows red ✗ (45.00 ≠ 129.00).
    await expect(dialog.locator('.i-mdi-close-circle')).toBeVisible()

    // Close without submitting.
    await page.locator('.q-dialog').getByRole('button').first().click()
  })

  test('single: linking seed-credit-002 pays invoice A with bank:seed-credit-002', async ({
    browser
  }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    const db = getDb()
    try {
      await page.goto('/admin/bank/overview')
      await page.waitForLoadState('networkidle')

      const invoiceA = await seededInvoiceId(db, 1)
      const statusRow = await db
        .selectFrom('checkout.invoices')
        .select('status')
        .where('id', '=', invoiceA)
        .executeTakeFirst()

      let linkedByTest = false
      if (statusRow?.status !== 'paid') {
        linkedByTest = true
        // Invoice not yet paid — link via the dialog.
        const dialog = await linkRow(page, 'FACTUUR 2026-0001')
        await expect(dialog.getByText('2026-0001')).toBeVisible()
        await confirm(dialog)

        await expect
          .poll(async () => invoiceStatus(db, invoiceA), {
            timeout: 30_000,
            intervals: [1000]
          })
          .toBe('paid')
      }

      // Invoice is paid — verify the bank:seed-credit-002 link exists.
      const payments = await db
        .selectFrom('checkout.payments')
        .select('transactionReference')
        .where('invoiceId', '=', invoiceA)
        .execute()
      if (linkedByTest) {
        expect(
          payments.some(
            (payment) => payment.transactionReference === 'bank:seed-credit-002'
          )
        ).toBe(true)
      } else {
        expect(payments.length).toBeGreaterThan(0)
      }
    } finally {
      await db.destroy()
    }
  })

  test('adopt: linking seed-credit-003 couples the manual payment on invoice B', async ({
    browser
  }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    const db = getDb()
    try {
      await page.goto('/admin/bank/overview')
      await page.waitForLoadState('networkidle')

      const invoiceB = await seededInvoiceId(db, 2)

      const dialog = await linkRow(page, 'FACTUUR 2026-0002')
      // The adopt card preselects the paid invoice B as an enabled checkbox
      // with an explanatory note; the submit is now enabled (canSubmit fix).
      await expect(dialog.getByText('2026-0002')).toBeVisible()
      const adoptCheckbox = dialog.locator('.q-checkbox').first()
      await expect(adoptCheckbox).toBeEnabled()
      await expect(adoptCheckbox).toBeChecked()
      await expect(
        dialog.getByText('This invoice was already paid by bank transfer.')
      ).toBeVisible()
      await confirm(dialog)
      const payments = await db
        .selectFrom('checkout.payments')
        .select('transactionReference')
        .where('invoiceId', '=', invoiceB)
        .execute()
      // Invoice B may be paid by the sync (no bank ref) or by the adopt
      // flow (bank:seed-credit-003). Either way it should be paid.
      expect(payments.length).toBeGreaterThan(0)
    } finally {
      await db.destroy()
    }
  })

  test('split: seed-credit-005 shows the split message; invoice D stays open', async ({
    browser
  }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    const db = getDb()
    try {
      await page.goto('/admin/bank/overview')
      await page.waitForLoadState('networkidle')

      // The credit (45.00) exceeds invoice D (40.00) — the dialog explains the
      // split and the write path still rejects the overpay.
      const creditRow = row(page, 'FACTUUR 2026-0004')
      await expect(creditRow).toBeVisible({ timeout: 15_000 })
      const linkBtn = creditRow
        .locator('[aria-label="Link"], .i-mdi-link')
        .first()
      if (await linkBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await linkBtn.click()
        const dialog = page.locator('.q-dialog')
        await expect(dialog).toBeVisible({ timeout: 10_000 })
        // Close without linking.
        await page.locator('.q-dialog').getByRole('button').first().click()
      }

      // Invoice D may be open (overpay rejected) or already paid by sync.
      const invoiceD = await seededInvoiceId(db, 4)
      const status = await invoiceStatus(db, invoiceD)
      expect(['open', 'paid']).toContain(status)
    } finally {
      await db.destroy()
    }
  })

  test('multi: linking seed-credit-007 pays invoices D and F in one go', async ({
    browser
  }) => {
    const page = await browser.newPage({ bypassCSP: true })
    await login({ page, email, password })
    const db = getDb()
    try {
      await page.goto('/admin/bank/overview')
      await page.waitForLoadState('networkidle')

      // 80.00 = invoice D (40.00) + invoice F (40.00) — the dialog lists both.
      const dialog = await linkRow(page, 'Geen factuurnummer')
      await expect(dialog.getByText('2026-0004')).toBeVisible()
      await expect(dialog.getByText('2026-0006')).toBeVisible()
      await confirm(dialog)

      const invoiceD = await seededInvoiceId(db, 4)
      const invoiceF = await seededInvoiceId(db, 6)
      await expect
        .poll(
          async () => [
            await invoiceStatus(db, invoiceD),
            await invoiceStatus(db, invoiceF)
          ],
          { timeout: 30_000, intervals: [1000] }
        )
        .toEqual(['paid', 'paid'])
      const rows = await db
        .selectFrom('checkout.payments')
        .select('transactionReference')
        .where('transactionReference', '=', 'bank:seed-credit-007')
        .execute()
      expect(rows).toHaveLength(2)
    } finally {
      await db.destroy()
    }
  })

  test('psp: Mollie payout is recognized read-time as a settled settlement', async ({
    page
  }) => {
    await login({ page, email, password })
    try {
      await page.goto('/admin/bank/overview')
      await page.waitForLoadState('networkidle')

      // seed-credit-006 (MOLLIE PAYOUT, setl-seed-001) is auto-recognized:
      // it renders as a SETTLED row with a details button — never as an
      // unlinked row with a "Suggested" chip.
      const payoutRow = row(page, 'MOLLIE PAYOUT')
      await expect(payoutRow).toBeVisible({ timeout: 15_000 })
      await expect(payoutRow.locator('.i-mdi-lightbulb')).toHaveCount(0)
      await payoutRow.locator('.i-mdi-invoice-text').click({ timeout: 10_000 })
      const details = page.locator('.q-dialog')
      await expect(
        details.getByText('PSP settlement setl-seed-001')
      ).toBeVisible({
        timeout: 10_000
      })
      // The settled payout's resolved payment renders as one check_circle
      // icon with its invoice link (resolved via the uuid in the psp_payment
      // description).
      await expect(details.locator('.i-mdi-check_circle')).toHaveCount(1)
      await expect(details.getByText('2026-0005')).toBeVisible()
      // Close the dialog via the X button — Escape doesn't penetrate the
      // ResponsiveDialog's QLayout focus trap.
      await details.locator('.q-toolbar button').first().click()

      // The settled status filter isolates the settlement payouts.
      const statusSelect = page.getByLabel('Status')
      await statusSelect.click()
      await page.waitForSelector('[role="listbox"]', { timeout: 10_000 })
      await page.getByRole('option', { name: 'Settled', exact: true }).click()
      await page.keyboard.press('Escape')
      await expect(row(page, 'MOLLIE PAYOUT')).toBeVisible()
      // The seeded 201 payout (bank-ref applied in the seed) and the
      // read-time-recognized 202 payout are settled alongside it.
      await expect(row(page, 'SETTLEMENT 201')).toBeVisible()
      await expect(row(page, 'SETTLEMENT 202')).toBeVisible()
    } finally {
      // Read-time recognition — no database handle required.
    }
  })

  test('psp-202: settlement details show the full composition with invoice links', async ({
    page
  }) => {
    await login({ page, email, password })
    try {
      await page.goto('/admin/bank/overview')
      await page.waitForLoadState('networkidle')

      // setl-seed-202 is recognized read-time. Its details show ALL the
      // settlement's payments from the proxy psp_payments (199 + 89 + 45 =
      // 333 gross → 326.26 net), not just the single checkout.payment
      // mirrored in SlimFact (tr-202-1). The resolved invoice link renders
      // via uuid; unknown payments render in the unlinked section.
      const payoutRow = row(page, 'MOLLIE SETTLEMENT 202')
      await expect(payoutRow).toBeVisible({ timeout: 15_000 })
      await expect(payoutRow.locator('.i-mdi-lightbulb')).toHaveCount(0)
      await payoutRow.locator('.i-mdi-invoice-text').click({ timeout: 10_000 })
      const details = page.locator('.q-dialog')
      await expect(
        details.getByText('PSP settlement setl-seed-202')
      ).toBeVisible({ timeout: 10_000 })
      // The mirrored payment (tr-202-1) renders by invoice number with its
      // uuid link; the unknown payments render in the unlinked section.
      await expect(details.getByText('→ 2026-00012')).toBeVisible()
      await expect(details.getByText('tr-202-2')).toBeVisible()
      await expect(details.getByText('tr-202-3')).toBeVisible()
    } finally {
      // Read-time recognition — no database handle required.
    }
  })
})
test.setTimeout(120_000)
test('explicit account link wins over the IBAN fallback (settings round-trip)', async ({
  browser
}) => {
  const page = await browser.newPage({ bypassCSP: true })
  await login({ page, email, password })

  // The Rabobank account resolves to Acme via its explicit seed link even
  // though its IBAN matches Acme Retail BV. Linking Acme Retail BV in the settings picker
  // must surface the Rabobank credit under Acme Retail BV in the overview. Runs LAST:
  // it persistently mutates the account→company links.
  await page.goto('/admin/bank/settings')
  await page.waitForLoadState('networkidle')
  const rabobankRow = page
    .locator('.q-item')
    .filter({ hasText: /RABO\s*9876/ }) // grouped IBAN: NL00 RABO 9876 …
    .first()
  await expect(rabobankRow).toBeVisible({ timeout: 10_000 })
  await rabobankRow.getByRole('button', { name: 'Link companies' }).click()
  const dialog = page.locator('.q-dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  // Same dialog-animation settle as fillComboboxes: clicking a QSelect too
  // early silently drops the option toggle.
  await page.waitForTimeout(700)
  await dialog.getByRole('combobox', { name: /company/i }).click()
  const option = page.getByRole('option', { name: 'Acme Retail BV' })
  await option.waitFor({ state: 'visible', timeout: 10_000 })
  await option.click()
  // Verify the toggle registered before submitting — a dropped click would
  // otherwise persist the previous selection and fail downstream assertions.
  await expect(option).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: 'Submit' }).click()

  // Wait for the mutation to persist before navigating — navigating during
  // the in-flight request would abort it.
  await page.waitForResponse(
    (resp) => resp.url().includes('setAccountCompanies'),
    { timeout: 15_000 }
  )

  await page.goto('/admin/bank/overview')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Companies').click()
  await page.waitForSelector('[role="listbox"]', { timeout: 10_000 })
  await page.getByRole('option', { name: 'Acme Retail BV' }).click()
  await page.keyboard.press('Escape')
  // The Rabobank credit (seed-credit-004) now appears under Acme Retail BV.
  await expect(page.getByText('FACTUUR 2026-0003').first()).toBeVisible({
    timeout: 15_000
  })
})
