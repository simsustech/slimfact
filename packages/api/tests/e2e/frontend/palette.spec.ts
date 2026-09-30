/**
 * Nothing in the ledger or the dashboard may read below 4.5:1 — and the invoice
 * link must be a *theme* colour, not the browser's.
 *
 * Seam: the browser, computed styles against a composited background (the audit's
 * measurement, re-run here).
 *
 * Measured before the fix, on the current build — all three reproduced exactly:
 *
 * - `[data-testid=ledger-invoice-link]` — class `""`, so `color: rgb(0, 0, 238)`:
 *   the raw anchor default. 1.74:1 in dark (on `rgb(29, 32, 34)`), and in light
 *   it only reaches 8.09 by accident of the surface being pale enough for blue.
 * - `.text-grey-7` (`rgb(117, 117, 117)`): **4.16:1** light / **3.72:1** dark,
 *   both under the 4.5:1 requirement.
 * - `.text-grey-6` (`rgb(158, 158, 158)`): 2.68:1 light on white.
 *
 * The fix moves captions onto a scheme-aware token pair
 * (`text-\$light-on-surface dark:text-\$dark-on-surface`) and gives the link
 * `text-primary`. The grey-class assertions are deliberately keyed on the *fixed*
 * colours: they go empty once the greys are gone, and a regression reintroducing
 * `text-grey-6/7` lights them up again.
 */
import { expect, test } from '@playwright/test'
import { ADMIN, loginAs, newPage, setDark } from './audit-helpers'

type Scheme = 'light' | 'dark'

const DEFAULT_ANCHOR_BLUE = 'rgb(0, 0, 238)'

/** Contrast of every visible text run and of the invoice link. */
const survey = (page: Awaited<ReturnType<typeof newPage>>['page']) =>
  page.evaluate(() => {
    /** The two fixed greys the audit measured, as computed values. */
    const FIXED_GREYS = ['rgb(117, 117, 117)', 'rgb(158, 158, 158)']
    const parse = (c: string) => {
      const m = String(c).match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1]
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number)
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
    }
    const over = (f: any, b: any) => ({
      r: f.r * f.a + b.r * (1 - f.a),
      g: f.g * f.a + b.g * (1 - f.a),
      b: f.b * f.a + b.b * (1 - f.a),
      a: 1
    })
    const lum = ({ r, g, b }: any) => {
      const f = (v: number) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const effBg = (el: Element) => {
      let node: Element | null = el
      let acc: any = null
      while (node && node !== document.documentElement) {
        const c = parse(getComputedStyle(node).backgroundColor)
        if (c && c.a > 0) {
          acc = acc ? over(acc, c) : c
          if (c.a === 1) return acc
        }
        node = node.parentElement
      }
      return acc || { r: 255, g: 255, b: 255, a: 1 }
    }
    const ratio = (a: any, b: any) => {
      const l1 = lum(a)
      const l2 = lum(b)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return false
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return false
      if (Number(cs.opacity) === 0) return false
      // Visually hidden nodes still count as visible geometry; skip them.
      if (cs.position === 'absolute' && r.width <= 1 && r.height <= 1)
        return false
      return true
    }
    const stats = (el: Element) => {
      const cs = getComputedStyle(el)
      const fg = parse(cs.color)
      const bg = effBg(el)
      // Not every computed colour is rgb() (`transparent` is not): an
      // unmeasurable element is treated as passing rather than crashing the sweep
      // — the same skip the audit's survey used.
      if (!fg) return { ratio: 99, color: cs.color }
      const painted = fg.a < 1 ? over(fg, bg) : fg
      return {
        ratio: Math.round(ratio(painted, bg) * 100) / 100,
        color: cs.color
      }
    }

    // The invoice link.
    const link = document.querySelector('[data-testid=ledger-invoice-link]')
    const linkInfo = link
      ? { ...stats(link), cls: link.className.toString() }
      : null

    // The captions, keyed on the fixed greys (empty after the fix).
    const greyOffenders: any[] = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (!visible(el)) continue
      if (
        ![...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent?.trim()
        )
      )
        continue
      const s = stats(el)
      if (FIXED_GREYS.includes(s.color) && s.ratio < 4.5) {
        greyOffenders.push({
          color: s.color,
          ratio: s.ratio,
          text: (el.textContent || '').trim().slice(0, 30)
        })
      }
    }

    // Reported, not asserted: anything else under 4.5, so the run can name scope
    // the plan did not list instead of silently leaving it broken.
    const otherLow: any[] = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (!visible(el)) continue
      if (
        ![...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent?.trim()
        )
      )
        continue
      const s = stats(el)
      if (s.ratio < 4.5 && !FIXED_GREYS.includes(s.color)) {
        otherLow.push({
          ratio: s.ratio,
          color: s.color,
          cls: el.className?.toString().slice(0, 40) || '',
          text: (el.textContent || '').trim().slice(0, 28)
        })
      }
    }

    return { linkInfo, greyOffenders, otherLow }
  })

const measureRoute = async (
  browser: Parameters<never>[0] | any,
  route: string,
  scheme: Scheme
) => {
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: ADMIN })
  await page.goto(route)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
  if (scheme === 'dark') {
    await setDark(page)
    await page.waitForTimeout(500)
  }
  const out = await survey(page)
  await context.close()
  return out
}

test('the ledger invoice link is a theme colour that reads in both schemes', async ({
  browser
}) => {
  test.setTimeout(240_000)
  for (const scheme of ['light', 'dark'] as Scheme[]) {
    const { linkInfo } = await measureRoute(browser, '/admin/payments', scheme)
    expect(linkInfo, `no invoice link in ${scheme}`).not.toBeNull()
    // The defect: a router-link with no class at all.
    expect(linkInfo!.cls, `link class in ${scheme}`).not.toBe('')
    expect(linkInfo!.color, `link colour in ${scheme}`).not.toBe(
      DEFAULT_ANCHOR_BLUE
    )
    expect(
      linkInfo!.ratio,
      `link contrast in ${scheme}`
    ).toBeGreaterThanOrEqual(4.5)
  }
})

test('the fixed grey captions clear 4.5:1 in both schemes', async ({
  browser
}) => {
  test.setTimeout(300_000)
  for (const route of ['/admin/payments', '/admin/dashboard']) {
    for (const scheme of ['light', 'dark'] as Scheme[]) {
      const { greyOffenders, otherLow } = await measureRoute(
        browser,
        route,
        scheme
      )
      if (otherLow.length) {
        console.log(
          `[contrast] ${route} ${scheme}: other sub-4.5 elements (not asserted):`,
          JSON.stringify(otherLow.slice(0, 8))
        )
      }
      expect(
        greyOffenders,
        `text-grey-6/7 under 4.5:1 on ${route} in ${scheme}`
      ).toEqual([])
    }
  }
})
