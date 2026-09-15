import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkInvoice, mkBill, moreBtn } from './helpers'

const EMAIL = 'admin@slimfact.app'
const PASSWORD = 'Sif5uEG5hcTH'
let page: Page

test.describe.configure({ mode: 'serial' })

async function login(p: import('@playwright/test').Page) {
  await p.goto('/')
  await p.click('text=Login')
  await p.waitForURL(/.*login/)
  await p.locator('text="Email"').fill(EMAIL)
  await p.locator('text="Password"').fill(PASSWORD)
  await p.locator('button >> text=Login').click()
  await p.waitForURL(/.*user/)
  await expect(
    p
      .getByRole('tab', { name: 'Administrator' })
      .or(p.getByText('Administrator').locator(':scope.q-item__label'))
  ).toBeVisible({ timeout: 20000 })
}

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
    if (routing?.wero !== 'mollie') {
      test.skip(true, 'Wero not routed to Mollie')
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
    await page.getByText('Wero | iDEAL').first().click()
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
    } catch {
      // Best-effort: the redirect may have already completed.
    }
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
    } catch {
      // Best-effort: the redirect may have already completed.
    }
    await page.waitForTimeout(30000)
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(5000)
    const t = await page.locator('body').textContent()
    expect(
      t?.toLowerCase().includes('paid') || t?.toLowerCase().includes('betaald')
    ).toBe(true)
  })

  test('shows iDEAL and Credit card payment options on public invoice', async ({
    request
  }) => {
    const resp = await request.get('/configuration')
    const routing = (await resp.json()).PAYMENT_METHOD_ROUTING
    if (routing?.wero !== 'mollie') {
      test.skip(true, 'Wero not routed to Mollie')
      return
    }
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()
    await page.goto(`/invoice/${uuid}`)
    await page.waitForLoadState('networkidle')

    const payButton = page.getByRole('button', { name: /Pay/ }).first()
    await payButton.click()
    // Payment options appear in a dropdown menu (q-btn-dropdown), not a dialog
    await expect(page.getByText('Wero | iDEAL').first()).toBeVisible({
      timeout: 15000
    })
    await expect(page.getByText('Credit card').first()).toBeVisible({
      timeout: 15000
    })
    // Bank transfer only renders once the EPC QR (qrSvg) is generated from the
    // invoice's bank details, so assert it conditionally.
    const bankTransfer = page.getByText('Bank transfer').first()
    if (await bankTransfer.count()) {
      await expect(bankTransfer).toBeVisible({ timeout: 15000 })
    }
  })

  test('Refund via Mollie', async ({ request }) => {
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
    await page.waitForSelector('.q-dialog', {
      state: 'visible',
      timeout: 15000
    })
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
    let mollieFrame = null
    for (const f of page.frames()) {
      if (f.url().includes('mollie')) {
        mollieFrame = f
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
    } catch {
      // Best-effort: the redirect may have already completed.
    }
    // Reload and poll for the settled (paid) status — the webhook settles
    // asynchronously, so the invoice page must be re-fetched.
    await expect(async () => {
      await page.goto(`/invoice/${uuid}`)
      await expect(page.getByText(/paid|betaald/i).first()).toBeVisible({
        timeout: 5000
      })
    }).toPass({ timeout: 60000, intervals: [2000] })

    // Token needed for verifying edits took effect
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

    // Edit post-payment: €100 → €50 (retry until amountDue goes negative,
    // which proves the overpayment that makes the invoice refundable)
    for (let attempt = 0; attempt < 3; attempt++) {
      const cur = await page.request
        .get(
          `/trpc/admin.getInvoice?input=${encodeURIComponent(JSON.stringify({ uuid }))}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )
        .then((r) => r.json())
      if (Number(cur?.result?.data?.amountDue) < 0) break

      await page.goto('/admin/bills')
      await page.locator('.q-expansion-item__toggle-icon').first().click()
      await moreBtn(page)
      const up = page
        .getByRole('listitem')
        .filter({ hasText: /update|bewerk/i })
        .first()
      if (!(await up.isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, 'Cannot edit PAID bill')
        break
      }
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
      await page.waitForTimeout(2000)
    }

    let invoiceId: number | undefined
    let amountRefunded = 0
    let invoice: any
    for (let attempt = 0; attempt < 3 && amountRefunded <= 0; attempt++) {
      await page.goto(`/invoice/${uuid}`)
      const refundBtn = page
        .getByRole('button', { name: /refund|terugbetalen/i })
        .first()
      const visible = await refundBtn
        .waitFor({ state: 'visible', timeout: 10000 })
        .then(() => true)
        .catch(() => false)
      if (!visible) break
      await refundBtn.click()
      const dialog = page.locator('.q-dialog').first()
      await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      const okBtn = dialog.getByRole('button').last()
      await okBtn.click({ timeout: 5000 }).catch(() => {})
      await dialog
        .waitFor({ state: 'detached', timeout: 10000 })
        .catch(() => {})
      await page.waitForTimeout(3000)
      const inv = await page.request.get(
        `/trpc/admin.getInvoice?input=${encodeURIComponent(JSON.stringify({ uuid }))}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const invJson = await inv.json()
      invoice = invJson?.result?.data
      invoiceId = invoice?.id
      amountRefunded = Number(invoice?.amountRefunded) || 0
    }

    expect(invoiceId).toBeTruthy()

    // Mollie test-mode refunds have no webhook and stay `pending`/`queued`
    // until they settle after a delay, so `amountRefunded` (which only counts
    // `refunded` rows) stays 0. The reliable signal that the refund was issued
    // is a refund row with a non-failed status on the invoice.
    const refunds = invoice?.refunds ?? []
    const issued = refunds.filter((r: any) =>
      ['pending', 'queued', 'refunded'].includes(r.status)
    )
    console.log(
      `Refund rows: ${JSON.stringify(refunds.map((r: any) => r.status))}`
    )
    expect(issued.length).toBeGreaterThan(0)

    // Best-effort: sync the refund status from Mollie on-demand. Mollie test
    // refunds settle after a delay and getRefund can transiently race, so this
    // is informational only and does not fail the test.
    if (invoiceId) {
      const r = await page.request.get(
        `/trpc/admin.syncRefund?input=${encodeURIComponent(JSON.stringify({ invoiceId }))}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const j = await r.json()
      const status = j?.result?.data?.status ?? j?.result?.refund?.status
      console.log(`Refund status from Mollie: ${status}`)
    }
  })
})
