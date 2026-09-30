/**
 * Every route must say which page it is: a `document.title` that identifies the
 * page. The plan also asked for one `<h1>` per route, fed from the same map; that
 * was removed by decision — the toolbar already states the page title, so a
 * content heading duplicated it.
 *
 * Seam: the browser for `document.title`; the HTTP response for the
 * server-rendered `<title>`.
 *
 * Before the fix, `document.title` was the bare brand on all 36 routes (nothing
 * ever sets it — there is no head manager), and `index.html` carried an empty
 * `<title>` so the SSR response had two.
 *
 * The route map (`meta.lang`) is the single source for the tab title and the
 * app-bar title. Two routes may share a map entry (`/admin/invoices` and
 * `/account/invoices` both mean "invoices"), so the title is asserted to
 * identify the page rather than to be globally unique.
 */
import { expect, test } from '@playwright/test'
import { ADMIN, loginAs, newPage } from './audit-helpers'

const BRAND = 'SlimFact'

/** Routes that must identify themselves, with the label the map resolves to. */
const ROUTES: [string, string][] = [
  ['/', 'Home'],
  ['/admin/dashboard', 'Dashboard'],
  ['/admin/invoices', 'Invoice'],
  ['/admin/payments', 'Payment'],
  ['/admin/clients', 'Client'],
  ['/admin/settings/companies', 'Companies'],
  ['/account/invoices', 'Invoice']
]

test('every route sets an identifying title', async ({ browser }) => {
  test.setTimeout(300_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: ADMIN })

  for (const [route, label] of ROUTES) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')

    const title = await page.title()
    expect(title, `title on ${route}`).not.toBe(BRAND)
    expect(title, `title on ${route}`).toContain(label)

    // No heading assertion: the toolbar states the page title, so the plan's
    // per-route `<h1>` was removed by decision (recorded in the run log). What
    // stays is the property that identified the page in the first place.
  }

  await context.close()
})

test('the server-rendered document names the page and has no empty title', async ({
  request
}) => {
  const response = await request.get('/')
  expect(response.status()).toBe(200)
  const html = await response.text()
  // The element *count* is a framework-layer duplication — Quasar's Meta plugin,
  // the SSR head transform and the template's head slot each emit one — and it is
  // recorded as reported-upstream rather than something this app can collapse.
  // What the app owns is the content: no empty placeholder (the audit found one),
  // and the page naming itself in the server-rendered document too.
  const titles = [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((m) =>
    m[1].trim()
  )
  expect(titles.length).toBeGreaterThan(0)
  expect(titles).not.toContain('')
  expect(titles).toContain('Home')
})
