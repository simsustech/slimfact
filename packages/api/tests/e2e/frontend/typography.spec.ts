/**
 * Headings take MD3's roles, not Quasar's MD2 scale.
 *
 * Reproducer (observed): every heading used the MD2 classes — `.text-h4`
 * computed `34px/400`, `.text-h6` `20px/500` — while the preset emits MD3's
 * roles as tokens on `body` (`--q-headline-small` = `400 24px/32px Roboto`,
 * from `theme/index.ts`). MD3 has no 34px role, so the dashboard title sat
 * between two of them.
 *
 * Seam: the computed style of the rendered heading, compared against the token
 * the stylesheet actually ships — read from `body` — so the assertion cannot
 * drift from the token, and a missing token fails loudly instead of passing.
 *
 * The absence check is the other half: a half-migrated page still looks right in
 * a screenshot, because the MD2 class keeps winning wherever it remains.
 */
import { expect, test } from '@playwright/test'
import { ADMIN, loginAs, newPage } from './audit-helpers'

/** The MD2 heading classes no audited page may still use. */
const MD2_HEADINGS = [
  '.text-h1',
  '.text-h2',
  '.text-h3',
  '.text-h4',
  '.text-h5',
  '.text-h6'
]

const px = (value: string): number => Number.parseFloat(value)

test.describe('MD3 typography', () => {
  test('the dashboard title takes headline-small, not the MD2 h4', async ({
    browser
  }) => {
    const { page } = await newPage(browser, { width: 1440, height: 900 })
    await loginAs({ page, account: ADMIN })
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    const measured = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      if (!h1) return { missing: true }
      const style = getComputedStyle(h1)
      const body = getComputedStyle(document.body)
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        tokenSize: body.getPropertyValue('--q-headline-small-size').trim(),
        tokenShorthand: body.getPropertyValue('--q-headline-small').trim()
      }
    })

    expect(measured, 'the dashboard must render an <h1>').not.toHaveProperty(
      'missing'
    )
    expect(
      measured.tokenSize,
      '--q-headline-small-size must be emitted (the role token)'
    ).toBeTruthy()

    expect(
      px(measured.fontSize),
      `the <h1> is ${measured.fontSize}, headline-small is ${measured.tokenSize} (token: ${measured.tokenShorthand})`
    ).toBe(px(measured.tokenSize))
    expect(measured.fontWeight).toBe('400')
  })

  test('no audited page still carries an MD2 heading class', async ({
    browser
  }) => {
    const { page } = await newPage(browser, { width: 1440, height: 900 })
    await loginAs({ page, account: ADMIN })

    const offenders: Record<string, string[]> = {}
    for (const route of ['/admin/dashboard', '/admin/payments']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const found = await page.evaluate(
        (selectors: string[]) =>
          selectors
            .map((sel) => [sel, document.querySelectorAll(sel).length] as const)
            .filter(([, count]) => count > 0)
            .map(([sel, count]) => `${sel} ×${count}`),
        MD2_HEADINGS
      )
      if (found.length > 0) offenders[route] = found
    }

    expect(
      offenders,
      'these pages still render MD2 heading classes'
    ).toStrictEqual({})
  })
})
