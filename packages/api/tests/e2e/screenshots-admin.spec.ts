import { test } from '@playwright/test'
import { initializePage, login } from './setup'

const PAGES: [string, string, number?][] = [
  ['/admin/invoices', 'admin-invoices', 2000],
  ['/admin/bills', 'admin-bills', 2000],
  ['/admin/subscriptions', 'admin-subscriptions', 2000],
  ['/admin/clients', 'admin-clients', 2000],
  ['/admin/settings/companies', 'admin-companies', 2000],
  ['/admin/settings/numberprefixes', 'admin-numberprefixes', 2000],
  ['/admin/settings/exports', 'admin-exports', 2000]
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function setup(browser: any) {
  const page = await initializePage({ browser })
  await login({ page, email: 'admin@slimfact.app', password: 'Sif5uEG5hcTH' })
  return page
}

async function snap(page: any, suffix: string) {
  for (const [route, name, wait = 2000] of PAGES) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await delay(wait)
    await page.screenshot({
      path: `../docs/public/screenshots/${suffix ? name + '-' + suffix : name}.png`,
      fullPage: false
    })
  }
}

test('en-desktop', async ({ browser }) => {
  test.setTimeout(120000)
  const page = await setup(browser)
  await snap(page, '')
})

test('en-mobile', async ({ browser }) => {
  test.setTimeout(120000)
  const page = await setup(browser)
  await page.setViewportSize({ width: 375, height: 812 })
  await snap(page, 'mobile')
})
