/**
 * Switching language must re-label the ledger table.
 *
 * Seam: the browser — switch the language through the UI the user uses, then read
 * the table headers.
 *
 * `PaymentsPage`'s `columns` array (and the filter option arrays) read
 * `lang.value.*` once, while `<script setup>` runs. Everything rendered from a
 * template re-evaluates on a language change; the columns do not, so the page
 * ends up half Dutch and half English — chrome and summary translated, headers
 * still English.
 *
 * A reload would not catch this: it rebuilds the component with the new locale.
 */
import { expect, test } from '@playwright/test'
import { ADMIN, loginAs, newPage, setLocale } from './audit-helpers'

test('switching language re-labels the ledger table', async ({ browser }) => {
  test.setTimeout(180_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: ADMIN })

  await page.goto('/admin/payments')
  await page.waitForLoadState('networkidle')

  const head = page.locator('thead')
  await expect(head).toContainText('Method', { timeout: 30_000 })
  await expect(head).toContainText('Description')

  await setLocale(page, 'Dutch')

  // The page around the table is already Dutch today…
  await expect(page.getByText('Zoeken')).toBeVisible({ timeout: 30_000 })
  // …so the table must be as well.
  await expect(head).toContainText('Methode')
  await expect(head).toContainText('Omschrijving')

  // The filter option arrays are built the same way, so they must translate too.
  // The methods combobox carries labels (the status one does not — it holds raw
  // enum values, which is a separate finding).
  await page.locator('[data-testid=ledger-filters-btn]').click()
  await page.getByRole('combobox', { name: 'Methoden' }).click()
  const options = (
    await page.locator('.q-menu:visible .q-item').allInnerTexts()
  ).map((t) => t.trim())
  expect(options).toContain('Bank overschrijving')
  expect(options).not.toContain('Bank transfer')

  await context.close()
})

/**
 * The rail and the dialogs must follow the language too.
 *
 * Reproducer (observed, after switching to German): the rail still read `Home`,
 * because it was a literal `label="Home"` in `NavigationTabs.vue` with no key in
 * any language file — while `de.ts` already translates `home.title` to
 * `Startseite`. The same shape of bug sat on the dialogs' Cancel buttons.
 *
 * `nl.ts`'s `administrator: 'Administrator'` is *not* a defect (a correct Dutch
 * word), and neither is `lang.account.title` — only the untranslated literals are.
 */
test('switching to German re-labels the rail and the dialogs', async ({
  browser
}) => {
  test.setTimeout(180_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: ADMIN })

  await setLocale(page, 'German')

  // Two instances exist — the drawer rail and the mobile bar, the same pair
  // step 11 found — so target the visible one, not document order.
  const rail = page.locator('.navigation-rail:visible').first()
  await expect(rail).toBeVisible({ timeout: 30_000 })
  // The key exists and is translated; the literal ignored it.
  await expect(rail).toContainText('Startseite', { timeout: 30_000 })
  await expect(rail).not.toContainText('Home')

  // And the dialogs' Cancel was a literal too. Open one for real: an invoice
  // row's "Zahlung hinzufügen" submenu → cash → AddPaymentDialog.
  await page.goto('/admin/invoices')
  await page.waitForLoadState('networkidle')

  // The submenu lives inside the row's ⋮ ("more") menu, so that has to be
  // opened first — the same path invoice-flow.spec.ts walks. And only invoices
  // that still have an amount due render it, so probe rows rather than assuming
  // the first one qualifies.
  const payMenu = page.getByTestId('add-payment-menu')
  const rows = page.locator('.q-expansion-item')
  const rowCount = Math.min(await rows.count(), 5)
  let opened = false
  for (let i = 0; i < rowCount && !opened; i++) {
    const row = rows.nth(i)
    await row.locator('.q-expansion-item__toggle-icon').click()
    await row
      .locator('.q-expansion-item__content')
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {})
    const more = row
      .locator('button')
      .filter({ has: page.locator('.i-mdi-more-vert, .i-mdi-dots-vertical') })
      .first()
    if ((await more.count()) === 0) continue
    await more.click().catch(() => {})
    await page
      .locator('.q-menu, [role="menu"]')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {})
    opened = await payMenu
      .first()
      .isVisible()
      .catch(() => false)
    if (!opened) await page.keyboard.press('Escape')
  }
  expect(
    opened,
    'no invoice with an amount due exposed the add-payment submenu'
  ).toBe(true)

  await payMenu.first().click()
  await page.getByTestId('add-cash-payment').first().click()

  const dialog = page.locator('.q-dialog:visible').first()
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  // `de.ts` has `cancel: 'Abbrechen'`; the literal `label="Cancel"` ignored it.
  await expect(dialog).toContainText('Abbrechen', { timeout: 15_000 })
  await expect(dialog).not.toContainText('Cancel')

  await context.close()
})
