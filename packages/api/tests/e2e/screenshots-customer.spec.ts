import { test } from '@playwright/test'
import { initializePage, login } from './setup'

const PAGES: [string, string, number?][] = [
  ['/', 'homepage', 3000],
  ['/account/bills', 'customer-bills', 3000]
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function setup(browser: any) {
  const page = await initializePage({ browser })
  await login({ page, email: 'admin@slimfact.app', password: 'Sif5uEG5hcTH' })

  // Extract OIDC access token from localStorage (base64-encoded key ending with 'accessToken')
  const accessToken = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && atob(key).endsWith('accessToken')) {
        return localStorage.getItem(key)
      }
    }
    return null
  })

  return { page, accessToken }
}

async function switchLang(page: any, lang: string) {
  await page.locator('header button').last().click()
  await delay(500)
  await page
    .locator('.q-select')
    .filter({ hasText: /English|Nederlands|Deutsch/i })
    .first()
    .click()
  await delay(500)
  await page.getByRole('option', { name: lang }).click()
  await delay(1000)
  await page.keyboard.press('Escape')
  await delay(500)
}

async function snap(page: any, suffix: string) {
  for (const [route, name, wait = 2000] of PAGES) {
    await page.goto(route)
    await delay(wait)
    await page.screenshot({
      path: `../docs/public/screenshots/${suffix ? name + '-' + suffix : name}.png`,
      fullPage: false
    })
  }
}

async function snapInvoice(browser: any, accessToken: string, suffix: string) {
  if (!accessToken) return

  // Get first invoice UUID via tRPC API
  const apiRes = await fetch(
    'https://slimfact.localhost/trpc/admin.getInvoices?batch=1&input=%7B%220%22%3A%7B%22limit%22%3A1%7D%7D',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const apiData = (await apiRes.json()) as any
  const uuid = apiData[0]?.result?.data?.[0]?.uuid

  if (uuid) {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      serviceWorkers: 'block'
    })
    const pub = await ctx.newPage()
    await pub.goto(`/invoice/${uuid}`, { waitUntil: 'domcontentloaded' })
    // Allow time for Typst WASM to load from CDN and render the invoice
    await delay(15000)
    await pub.screenshot({
      path: `../docs/public/screenshots/${suffix ? 'invoice-public-' + suffix : 'invoice-public'}.png`,
      fullPage: false
    })
    // Download invoice PDF
    try {
      const downloadPromise = pub.waitForEvent('download', { timeout: 30000 })
      await pub.locator('.q-btn-dropdown--split button.q-btn').first().click({ timeout: 5000 })
      const download = await downloadPromise
      await download.saveAs(`../docs/public/screenshots/${suffix ? 'invoice-' + suffix : 'invoice'}.pdf`)
    } catch {
      // PDF download is best-effort
    }
    await ctx.close()
  }
}

test('en-desktop', async ({ browser }) => {
  test.setTimeout(120000)
  const { page, accessToken } = await setup(browser)
  await switchLang(page, 'English')
  await snap(page, '')
  await snapInvoice(browser, accessToken || '', '')
})

test('nl-desktop', async ({ browser }) => {
  test.setTimeout(120000)
  const { page, accessToken } = await setup(browser)
  await switchLang(page, 'Dutch')
  await snap(page, 'nl')
  await snapInvoice(browser, accessToken || '', 'nl')
})

test('en-mobile', async ({ browser }) => {
  test.setTimeout(120000)
  const { page, accessToken } = await setup(browser)
  await switchLang(page, 'English')
  await page.setViewportSize({ width: 375, height: 812 })
  await snap(page, 'mobile')
  await page.setViewportSize({ width: 1280, height: 900 })
  await snapInvoice(browser, accessToken || '', 'mobile')
})

test('nl-mobile', async ({ browser }) => {
  test.setTimeout(120000)
  const { page, accessToken } = await setup(browser)
  await switchLang(page, 'Dutch')
  await page.setViewportSize({ width: 375, height: 812 })
  await snap(page, 'nl-mobile')
  await page.setViewportSize({ width: 1280, height: 900 })
  await snapInvoice(browser, accessToken || '', 'nl-mobile')
})
