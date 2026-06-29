import { test, expect } from '@playwright/test'
import { mkInvoice } from './helpers'

const EMAIL = 'admin@slimfact.app'
const PASSWORD = 'Sif5uEG5hcTH'
let page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120000)
  page = await browser.newPage({ bypassCSP: true })
  await page.goto('/')
  await page.click('text=Login')
  await page.waitForURL(/.*login/)
  await page.locator('text="Email"').fill(EMAIL)
  await page.locator('text="Password"').fill(PASSWORD)
  await page.locator('button >> text=Login').click()
  await page.waitForURL(/.*user/)
  await expect(
    page
      .getByRole('tab', { name: 'Administrator' })
      .or(page.getByText('Administrator').locator(':scope.q-item__label'))
  ).toBeVisible({ timeout: 20000 })
})

test.afterAll(async () => {
  await page.close()
})
test.beforeAll(async ({ request }) => {
  const resp = await request.get('/configuration')
  const config = await resp.json()
  const routing = config.PAYMENT_METHOD_ROUTING
  if (!routing) {
    test.skip(true, 'No payment method routing configured')
  }
})

test.describe('Mollie', () => {
  test.setTimeout(300000)
  test.beforeEach(async () => {
    await page.goto('/admin/invoices')
    await page.waitForTimeout(3000)
    await page.waitForTimeout(5000)
  })

  test('iDEAL', async ({ request }) => {
    const resp = await request.get('/configuration')
    const routing = (await resp.json()).PAYMENT_METHOD_ROUTING
    if (routing?.ideal !== 'mollie') {
      test.skip(true, 'iDEAL not routed to Mollie')
      return
    }
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(5000)
    await expect(page.getByRole('button', { name: /Pay/ })).toBeVisible({
      timeout: 20000
    })
    await page.getByRole('button', { name: /Pay/ }).click()
    await page.waitForTimeout(1000)
    await page.getByText('iDEAL').first().click()
    await page.waitForTimeout(5000)
    for (const f of page.frames()) {
      if (f.url().includes('mollie')) {
        const bank = f.getByText('ABN AMRO').first()
        if ((await bank.count()) > 0) {
          await bank.click({ force: true })
          break
        }
      }
    }
    await page.waitForTimeout(5000)
    const paid = page.getByText('Paid', { exact: true })
    if ((await paid.count()) > 0) {
      await paid.click({ force: true })
      await page.waitForTimeout(500)
    }
    const cont = page
      .getByRole('link', { name: 'Continue' })
      .or(page.getByText('Continue'))
    if ((await cont.count()) > 0) await cont.first().click({ force: true })
    try {
      await page.waitForURL(/slimfact/, { timeout: 20000 })
    } catch {}
    await page.waitForTimeout(30000)
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(3000)
    const t = await page.locator('body').textContent()
    expect(
      t?.toLowerCase().includes('paid') || t?.toLowerCase().includes('betaald')
    ).toBe(true)
  })

  test('Creditcard', async ({ request }) => {
    const resp = await request.get('/configuration')
    const routing = (await resp.json()).PAYMENT_METHOD_ROUTING
    if (routing?.creditcard !== 'mollie') {
      test.skip(true, 'Creditcard not routed to Mollie')
      return
    }
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(5000)
    await expect(page.getByRole('button', { name: /Pay/ })).toBeVisible({
      timeout: 20000
    })
    await page.getByRole('button', { name: /Pay/ }).click()
    await page.waitForTimeout(1000)
    await page.getByText('Credit card').first().click()
    await page.waitForTimeout(5000)
    for (const f of page.frames()) {
      if (f.url().includes('mollie')) {
        const card = f.locator('#cardNumber')
        if ((await card.count()) > 0) {
          await card.fill('4543474002249996')
          await f.locator('#cardExpiryDate').fill('03/30')
          await f.locator('#cardCvv').fill('518')
          await f.locator('#cardHolder').fill('Test User')
          await f.locator('button[type="submit"]').click({ force: true })
        }
      }
    }
    await page.waitForTimeout(3000)
    const paid = page.getByText('Paid', { exact: true })
    if ((await paid.count()) > 0) {
      await paid.click({ force: true })
      await page.waitForTimeout(500)
    }
    const cont = page
      .getByRole('link', { name: 'Continue' })
      .or(page.getByText('Continue'))
    if ((await cont.count()) > 0) await cont.first().click({ force: true })
    try {
      await page.waitForURL(/slimfact/, { timeout: 20000 })
    } catch {}
    await page.waitForTimeout(30000)
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(5000)
    const t = await page.locator('body').textContent()
    expect(
      t?.toLowerCase().includes('paid') || t?.toLowerCase().includes('betaald')
    ).toBe(true)
  })

  test('shows iDEAL and Credit card payment options on public invoice', async ({ request }) => {
    const resp = await request.get('/configuration')
    const routing = (await resp.json()).PAYMENT_METHOD_ROUTING
    if (routing?.ideal !== 'mollie') {
      test.skip(true, 'iDEAL not routed to Mollie')
      return
    }
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()
    await page.goto(`/invoice/${uuid}`)
    await page.waitForLoadState('networkidle')

    const payButton = page.getByRole('button', { name: /Pay/ })
    await payButton.click()
    await page
      .getByRole('dialog')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {})

    await expect(page.getByText('iDEAL').first()).toBeVisible()
    await expect(page.getByText('Credit card').first()).toBeVisible()
    await expect(page.getByText('Bank transfer').first()).toBeVisible()
  })
})
