/**
 * Every interactive control must have an accessible name.
 *
 * Seam: the accessibility tree shape at the browser boundary — the same `accName`
 * computation the audit used, applied to the five routes where it found offenders
 * (9 unnamed on /admin/invoices, 7 on /account/invoices, 5 each on /admin/bills,
 * /admin/clients and /admin/settings/companies).
 *
 * An `aria-label=""` counts as *present* but yields no usable name, so the
 * computation reads the trimmed value and treats empty as missing.
 */
import { expect, test } from '@playwright/test'
import { ADMIN, CUSTOMER, loginAs, newPage } from './audit-helpers'

/** A control has no name when aria-label/labelledby/text/alt all resolve empty. */
const unnamedControls = async (page: Parameters<never>[0] | any) =>
  page.evaluate(() => {
    const accName = (el: Element) => {
      const al = el.getAttribute('aria-label')
      if (al && al.trim()) return al.trim()
      const lb = el.getAttribute('aria-labelledby')
      if (lb) {
        const text = lb
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim()
        if (text) return text
      }
      const t = (el.textContent || '').trim()
      if (t) return t
      const title = el.getAttribute('title')
      if (title?.trim()) return title.trim()
      const img = el.querySelector('img[alt]')
      if (img?.getAttribute('alt')?.trim())
        return img.getAttribute('alt')!.trim()
      return ''
    }
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return false
      const cs = getComputedStyle(el)
      return cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    return Array.from(
      document.querySelectorAll(
        'a[href], button, [role=button], [role=tab], [tabindex]:not([tabindex="-1"])'
      )
    )
      .filter((el) => visible(el) && !el.matches('input[type=hidden]'))
      .filter((el) => !accName(el))
      .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`)
  })

const ADMIN_ROUTES = [
  '/admin/invoices',
  '/admin/bills',
  '/admin/clients',
  '/admin/settings/companies'
]

test('every control on the admin lists has an accessible name', async ({
  browser
}) => {
  test.setTimeout(300_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: ADMIN })

  for (const route of ADMIN_ROUTES) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    const unnamed = await unnamedControls(page)
    // Name the offenders in the output: a count alone doesn't say what to fix.
    if (unnamed.length)
      console.log(`[a11y] ${route}: ${JSON.stringify(unnamed)}`)
    expect(unnamed, `unnamed controls on ${route}`).toEqual([])
  }

  await context.close()
})

test('the client portal list has an accessible name for every control', async ({
  browser
}) => {
  test.setTimeout(180_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: CUSTOMER })

  await page.goto('/account/invoices')
  await page.waitForLoadState('networkidle')
  expect(await unnamedControls(page)).toEqual([])

  await context.close()
})

test('the rail FAB says what it will create on this page', async ({
  browser
}) => {
  test.setTimeout(180_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: ADMIN })

  await page.goto('/admin/invoices')
  await page.waitForLoadState('networkidle')
  const invoicesFab = page.locator('#fabAdd')
  const invoicesName = await invoicesFab.evaluate((el: Element) =>
    (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
  )

  await page.goto('/admin/bills')
  await page.waitForLoadState('networkidle')
  const billsFab = page.locator('#fabAdd')
  const billsName = await billsFab.evaluate((el: Element) =>
    (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
  )

  expect(invoicesName).not.toBe('')
  expect(billsName).not.toBe('')
  expect(invoicesName).not.toBe(billsName)

  await context.close()
})
