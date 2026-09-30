import { expect, test } from '@playwright/test'
import { ADMIN, loginAs, newPage } from './audit-helpers'

/**
 * Reproducer (observed, create-invoice dialog): `role="dialog"`,
 * `aria-modal="true"`, `aria-labelledby=null`, and the dialog's own title
 * element empty — the sheet announced itself to assistive tech as an *unnamed*
 * dialog. `ResponsiveDialog` had a `title` slot that no call site filled and no
 * `aria-labelledby`, so the header showed only the close ✕ and Submit.
 *
 * The fix names the dialog from a `title` prop at every call site. This asserts
 * the caller-visible outcome: a real, non-empty accessible name.
 */
test('the create-invoice dialog has an accessible name', async ({
  browser
}) => {
  test.setTimeout(180_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: ADMIN })

  await page.goto('/admin/invoices')
  await page.waitForLoadState('networkidle')

  // Same trigger invoice-flow.spec.ts uses; the FAB carries a stable id.
  await page.locator('#fabAdd').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 15_000 })

  // `/\S/` is the whole point: non-empty. Today the role and aria-modal are
  // present but the name resolves to "", which is what an unnamed dialog means.
  await expect(dialog).toHaveAccessibleName(/\S/)

  // And it should be a real label, not a stub like "undefined" or a bare id.
  const name = await dialog.evaluate((el) => {
    const labelledby = el.getAttribute('aria-labelledby')
    const fromId = labelledby
      ? document.getElementById(labelledby)?.textContent
      : ''
    return ((el.getAttribute('aria-label') || '') + ' ' + (fromId || '')).trim()
  })
  expect(name.toLowerCase()).not.toContain('undefined')
  expect(name).not.toMatch(/^responsive-dialog-title/)

  await context.close()
})
