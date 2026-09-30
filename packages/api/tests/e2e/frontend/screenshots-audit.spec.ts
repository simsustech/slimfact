/**
 * The audit's capture pass: every renderable route at two viewports in both
 * schemes. Excluded from the normal suite by `playwright.config.ts`'s
 * `screenshots-*.spec.ts` ignore — run it on demand:
 *
 *   cd ~/Projects/slimfact/packages/api
 *   pnpm exec playwright test tests/e2e/frontend/screenshots-audit.spec.ts
 *
 * Read the pre-flight in `audit-helpers.ts` first; the linked worktrees must be
 * part of the image build or this measures published packages.
 *
 * Captures land in `test-results/frontend-audit/<scheme>/<viewport>/<slug>.png`.
 * Playwright wipes its output dir at the start of every run, so a capture run's
 * artefacts do not survive the next Playwright command — read them before
 * running anything else.
 */
import { mkdirSync, statSync } from 'node:fs'
import { expect, test, type Browser } from '@playwright/test'
import {
  ALL_ROUTE_GROUPS,
  AUDIT_DIR,
  BASE,
  delay,
  newPage,
  routeCount,
  setDark,
  settleMs,
  tryLoginAs,
  VIEWPORTS
} from './audit-helpers'

// Four sweeps, each creating its own contexts; serial so they do not compete
// for a browser and the DB-backed pages settle predictably.
test.describe.configure({ mode: 'serial' })

const shot = async (
  page: Awaited<ReturnType<typeof newPage>>['page'],
  dir: string,
  slug: string
) => {
  mkdirSync(dir, { recursive: true })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  // The public invoice page mounts Typst's WASM compiler before it can paint
  // the preview; the first paint was still a bare spinner at 7 s.
  await delay(settleMs(slug))
  await Promise.race([
    page.screenshot({ path: `${dir}/${slug}.png`, fullPage: true }),
    delay(20000)
  ])
}

async function sweep(
  browser: Browser,
  viewport: (typeof VIEWPORTS)[number],
  scheme: 'light' | 'dark'
) {
  const dir = `${AUDIT_DIR}/${scheme}/${viewport.name}`
  const written: string[] = []
  const skipped: string[] = []

  for (const group of ALL_ROUTE_GROUPS) {
    const { context, page } = await newPage(browser, viewport)
    if (group.session) {
      const ok = await tryLoginAs({ page, account: group.session })
      if (!ok) {
        skipped.push(group.key)
        await context.close()
        continue
      }
    }
    for (const [route, slug] of group.routes) {
      await page.goto(BASE + route)
      if (scheme === 'dark') await setDark(page).catch(() => {})
      await shot(page, dir, slug)
      written.push(`${dir}/${slug}.png`)
    }
    await context.close()
  }

  console.log(
    `[audit] ${scheme}/${viewport.name}: ${written.length} captures` +
      (skipped.length ? ` (skipped groups: ${skipped.join(', ')})` : '')
  )
  return { dir, written, skipped }
}

const runSweep = async (
  browser: Browser,
  viewport: (typeof VIEWPORTS)[number],
  scheme: 'light' | 'dark'
) => {
  const { written, skipped } = await sweep(browser, viewport, scheme)
  // The instrument's own guard: a sweep that wrote nothing (or wrote empty
  // files) must not report success. The route_total is logged, not asserted,
  // because the customer group arrives with the seed step.
  expect(written.length).toBeGreaterThan(0)
  for (const file of written) {
    expect(statSync(file).size, `${file} is empty`).toBeGreaterThan(0)
  }
  console.log(
    `[audit] ${scheme}/${viewport.name}: ${written.length}/${routeCount()} routes`
  )
  return { written, skipped }
}

for (const viewport of VIEWPORTS) {
  test(`light-${viewport.name}`, async ({ browser }) => {
    test.setTimeout(900_000)
    await runSweep(browser, viewport, 'light')
  })

  test(`dark-${viewport.name}`, async ({ browser }) => {
    test.setTimeout(900_000)
    await runSweep(browser, viewport, 'dark')
  })
}
