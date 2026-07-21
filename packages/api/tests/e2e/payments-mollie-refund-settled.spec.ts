import { test, expect } from '@playwright/test'
import { mkInvoice, mkBill, moreBtn } from './helpers'

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

// This test waits for Mollie's actual refund settlement, which in test mode
// can take 2+ hours (Mollie delays test refunds). It is intentionally EXCLUDED
// from the normal suite (see playwright.config.ts testIgnore) and is only run
// on demand, once, to verify end-to-end refund settlement.
test('Refund via Mollie (wait for settlement)', async ({ request }) => {
  test.setTimeout(3 * 60 * 60 * 1000)
  const routing = (await request.get('/configuration').then((r) => r.json()))
    .PAYMENT_METHOD_ROUTING
  if (routing?.wero !== 'mollie') {
    test.skip(true, 'Wero not routed to Mollie')
    return
  }
  const uuid = await mkBill(page)
  expect(uuid).toBeTruthy()

  // Edit pre-payment: €50 → €100
  await page.goto('/admin/bills')
  await page.locator('.q-expansion-item__toggle-icon').first().click()
  await moreBtn(page)
  await page
    .getByRole('listitem')
    .filter({ hasText: /update|bewerk/i })
    .first()
    .click()
  await page.waitForSelector('.q-dialog', { state: 'visible', timeout: 15000 })
  await page
    .locator('.q-dialog')
    .getByText(/1 x €50/)
    .first()
    .click()
  const pi = page
    .locator('.q-dialog')
    .getByRole('spinbutton', {
      name: /unit price|eenheidsprijs|list price|price/i
    })
    .first()
  await expect(pi).toBeVisible({ timeout: 10000 })
  await pi.evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set
    setter?.call(el, '100.00')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page
    .locator('.q-dialog')
    .getByRole('button', { name: /done|ok|opslaan/i })
    .first()
    .click()
  await page
    .locator('.q-dialog')
    .getByRole('button', { name: /submit|done|opslaan/i })
    .first()
    .click()

  // Pay via Wero | iDEAL (Mollie)
  await page.goto(`/invoice/${uuid}`)
  await expect(page.getByRole('button', { name: /Pay/ })).toBeVisible({
    timeout: 10000
  })
  await page.getByRole('button', { name: /Pay/ }).click()
  await page.getByText('Wero | iDEAL').first().click()
  await page.waitForTimeout(2000)
  for (const f of page.frames()) {
    if (f.url().includes('mollie')) {
      const bank = f.getByText('ABN AMRO').first()
      if ((await bank.count()) > 0) {
        await bank.click({ force: true })
        break
      }
    }
  }
  const paid = page.getByText('Paid', { exact: true })
  if ((await paid.count()) > 0) await paid.click({ force: true })
  const cont = page
    .getByRole('link', { name: 'Continue' })
    .or(page.getByText('Continue'))
  if ((await cont.count()) > 0) await cont.first().click({ force: true })
  try {
    await page.waitForURL(/slimfact/, { timeout: 20000 })
  } catch {}
  await expect(async () => {
    await page.goto(`/invoice/${uuid}`)
    await expect(page.getByText(/paid|betaald/i).first()).toBeVisible({
      timeout: 5000
    })
  }).toPass({ timeout: 60000, intervals: [2000] })

  // Edit post-payment: €100 → €50
  await page.goto('/admin/bills')
  await page.locator('.q-expansion-item__toggle-icon').first().click()
  await moreBtn(page)
  const up = page
    .getByRole('listitem')
    .filter({ hasText: /update|bewerk/i })
    .first()
  if (await up.isVisible({ timeout: 3000 }).catch(() => false)) {
    await up.click()
    await page.waitForSelector('.q-dialog', {
      state: 'visible',
      timeout: 15000
    })
    await page
      .locator('.q-dialog')
      .getByText(/1 x €100/)
      .first()
      .click()
    const p2 = page
      .locator('.q-dialog')
      .getByRole('spinbutton', {
        name: /unit price|eenheidsprijs|list price|price/i
      })
      .first()
    await expect(p2).toBeVisible({ timeout: 10000 })
    await p2.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      setter?.call(el, '50.00')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page
      .locator('.q-dialog')
      .getByRole('button', { name: /done|ok|opslaan/i })
      .first()
      .click()
    await page
      .locator('.q-dialog')
      .getByRole('button', { name: /submit|done|opslaan/i })
      .first()
      .click()
  } else {
    test.skip(true, 'Cannot edit PAID bill')
  }

  // Refund
  await page.goto(`/invoice/${uuid}`)
  await expect(
    page.getByRole('button', { name: /refund|terugbetalen/i }).first()
  ).toBeVisible({ timeout: 10000 })
  await page
    .getByRole('button', { name: /refund|terugbetalen/i })
    .first()
    .click()
  await page
    .locator('.q-dialog')
    .getByRole('button')
    .last()
    .click({ timeout: 5000 })

  const token = await page.evaluate(() => {
    const keys = Object.keys(localStorage)
    const b64key = keys.find((k) => {
      try {
        return atob(k).endsWith('accessToken')
      } catch {
        return false
      }
    })
    return b64key ? localStorage.getItem(b64key) || '' : ''
  })
  const inv = await page.request.get(
    `/trpc/admin.getInvoice?input=${encodeURIComponent(
      JSON.stringify({ uuid })
    )}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const invJson = await inv.json()
  const invoice = invJson?.result?.data
  const invoiceId = invoice?.id
  expect(invoiceId).toBeTruthy()

  // Poll the refund status until Mollie settles it (test refunds can take
  // 2+ hours). This verifies the end-to-end refund webhook/sync path.
  await expect(async () => {
    const r = await page.request.get(
      `/trpc/admin.syncRefund?input=${encodeURIComponent(
        JSON.stringify({ invoiceId })
      )}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const j = await r.json()
    const status = j?.result?.data?.status ?? j?.result?.refund?.status
    expect(status).toBe('refunded')
  }).toPass({ timeout: 3 * 60 * 60 * 1000, intervals: [60000] })
})
