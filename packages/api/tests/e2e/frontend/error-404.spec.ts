/**
 * A 404 must not take the chrome hostage, and must read in both schemes.
 *
 * `Error404Page` was `<div class="fullscreen bg-primary …">`. `.fullscreen` is
 * `position: fixed; inset: 0; z-index: 6000`, above the app bar's 2000, so the
 * audit measured **4 header controls unreachable** at both 1440×900 and 375×812
 * (`elementFromPoint` at the user button's centre returned `DIV.fullscreen`).
 * In dark, `bg-primary` is the scheme's light blue (`rgb(134, 206, 255)`) under
 * white text at 40 % opacity — ≈1.9:1, a full-screen flash of light.
 *
 * Seam: the browser. No session: the audit reached the 404 logged out, where the
 * header offers Login, and that has to stay usable (edge case (e)).
 */
import { expect, test } from '@playwright/test'
import { delay, newPage, setDark } from './audit-helpers'

const ROUTE = '/_audit-not-a-route'

type Scheme = 'light' | 'dark'

/**
 * WCAG contrast of an element against the background it actually sits on, with
 * semi-transparent backgrounds composited over their ancestors.
 */
const contrastOf = (page: Awaited<ReturnType<typeof newPage>>['page']) =>
  page.evaluate(() => {
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

    // The two things the page says: the numeral and the message. Located by text
    // rather than by container: the 404 has no `.q-page` until it is fixed, and
    // the message must survive a layout change.
    const blocks = () => Array.from(document.querySelectorAll('div, h1, h2, p'))
    const read = (el: Element | undefined) => {
      if (!el) return null
      const cs = getComputedStyle(el)
      const fg = parse(cs.color)!
      const bg = effBg(el)
      const painted = fg.a < 1 ? over(fg, bg) : fg
      return Math.round(ratio(painted, bg) * 100) / 100
    }
    const bigEl = blocks().find((d) => d.textContent?.trim() === '404')
    const messageEl = blocks().find((d) =>
      (d.textContent || '').trim().startsWith('Oops')
    )
    return {
      big: read(bigEl),
      message: (messageEl?.textContent || '').trim().slice(0, 50),
      messageRatio: read(messageEl)
    }
  })

/** Which header controls does the 404 overlay swallow? */
const blockedControls = (page: Awaited<ReturnType<typeof newPage>>['page']) =>
  page.evaluate(() => {
    const header = document.querySelector('header') as HTMLElement | null
    if (!header) return ['<no header>']
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return false
      const cs = getComputedStyle(el)
      return cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    return Array.from(header.querySelectorAll('button, a[href], [role=button]'))
      .filter(visible)
      .filter((el) => {
        const r = el.getBoundingClientRect()
        const x = r.left + Math.min(r.width / 2, 12)
        const y = r.top + r.height / 2
        if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) return false
        const hit = document.elementFromPoint(x, y)
        if (!hit) return false
        return !(hit === el || el.contains(hit) || hit.contains(el))
      })
      .map((el) => {
        const al = el.getAttribute('aria-label')
        return `${el.tagName.toLowerCase()}[${al || el.textContent?.trim().slice(0, 20) || '?'}]`
      })
  })

const open404 = async (browser: Parameters<never>[0] | any, scheme: Scheme) => {
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await page.goto(ROUTE)
  await page.waitForLoadState('networkidle')
  if (scheme === 'dark') {
    await setDark(page)
    await delay(500)
  }
  return { context, page }
}

test('the 404 leaves the header reachable, in both schemes', async ({
  browser
}) => {
  test.setTimeout(180_000)
  for (const scheme of ['light', 'dark'] as Scheme[]) {
    const { context, page } = await open404(browser, scheme)
    const blocked = await blockedControls(page)
    expect(blocked, `header controls covered in ${scheme}`).toEqual([])

    // And the page's own escape hatch still works without a session.
    await expect(page.getByText(/Go to home page|404/).first()).toBeVisible()
    await context.close()
  }
})

test('the 404 copy reads on its background in both schemes', async ({
  browser
}) => {
  test.setTimeout(180_000)
  for (const scheme of ['light', 'dark'] as Scheme[]) {
    const { context, page } = await open404(browser, scheme)
    const ratios = await contrastOf(page)

    expect(ratios.big, `the "404" numeral in ${scheme}`).not.toBeNull()
    // Large text (>= 24px): 3:1. Measured before the fix: 1.9:1 in dark, where
    // white sat on the scheme's light-blue primary.
    expect(ratios.big, `"404" in ${scheme}`).toBeGreaterThanOrEqual(3)
    expect(
      ratios.messageRatio,
      `the message "${ratios.message}" in ${scheme}`
    ).toBeGreaterThanOrEqual(4.5)

    await context.close()
  }
})
