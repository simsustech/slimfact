import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { dumpPage, mkInvoice, mkBill, moreBtn } from './helpers'

test.describe.configure({ mode: 'serial' })

const email = 'admin@slimfact.app'
const password = 'Sif5uEG5hcTH'

async function login(p: Page) {
  await p.goto('/')
  await p.click('text=Login')
  await p.waitForURL(/.*login/)
  await p.locator('text="Email"').fill(email)
  await p.locator('text="Password"').fill(password)
  await p.locator('button >> text=Login').click()
  await p.waitForURL(/.*user/)
  await expect(
    p
      .getByRole('tab', { name: 'Administrator' })
      .or(p.getByText('Administrator').locator(':scope.q-item__label'))
  ).toBeVisible({ timeout: 20000 })
}

async function completeStripePayment(p: Page): Promise<boolean> {
  try {
    await p.waitForURL(/stripe\.com/, { timeout: 15000 })
  } catch {
    return false
  }
  console.log('On Stripe:', p.url())

  const inForm = await p
    .locator('#payment-form')
    .isVisible({ timeout: 3000 })
    .catch(() => false)
  if (inForm) {
    const hasCard = await p
      .locator('#cardNumber')
      .isVisible({ timeout: 2000 })
      .catch(() => false)
    if (hasCard) {
      await p.fill('#cardNumber', '4242424242424242')
      await p.fill('#cardExpiry', '1234')
      await p.fill('#cardCvc', '123')
      console.log('Filled card')
    }
    await p.fill('#email', 'test@slimfact.app')
    await p.fill('#billingName', 'Test User')
    console.log('Filled email/name')
    await p.locator('button[type="submit"]').first().click({ timeout: 10000 })
    console.log('Clicked submit')
  }

  // Wait for redirect back — credit card auto-completes, iDEAL needs authorize
  try {
    await p.waitForURL(/slimfact|localhost/, { timeout: 60000 })
    console.log('Back on SlimFact:', p.url())
    return true
  } catch {
    // Still on Stripe — click authorize for iDEAL flow
  }

  try {
    await p
      .locator('#authorize-test-payment')
      .click({ force: true, timeout: 60000 })
  } catch {
    /* button not present, no-op */
  }

  try {
    await p.waitForURL(/slimfact|localhost/, { timeout: 60000 })
    console.log('Back on SlimFact:', p.url())
    return true
  } catch {
    console.log('Never back, at:', p.url())
    return false
  }
}

test.describe('iDEAL via Stripe', () => {
  test.setTimeout(300000)
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await login(page)
    const r = await page.request.get('/configuration')
    if (!r.ok() || (await r.json()).PAYMENT_METHOD_ROUTING?.ideal !== 'stripe')
      test.skip(true, 'iDEAL not routed to Stripe')
    await page.close()
  })
  test('iDEAL via Stripe', async ({ browser }) => {
    const page = await browser.newPage()
    await login(page)
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(3000)
    await expect(page.getByRole('button', { name: /Pay/ })).toBeVisible({
      timeout: 10000
    })
    await page.getByRole('button', { name: /Pay/ }).click()
    await page.waitForTimeout(300)
    await page.getByText('iDEAL').first().click()
    await page.waitForTimeout(5000)
    expect(await completeStripePayment(page)).toBe(true)
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(5000)
    expect(
      /paid|betaald/i.test((await page.locator('body').textContent()) || '')
    ).toBe(true)
    await page.close()
  })
})

test.describe('Creditcard via Stripe', () => {
  test.setTimeout(300000)
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await login(page)
    const r = await page.request.get('/configuration')
    if (
      !r.ok() ||
      (await r.json()).PAYMENT_METHOD_ROUTING?.creditcard !== 'stripe'
    )
      test.skip(true, 'Creditcard not routed to Stripe')
    await page.close()
  })
  test('Creditcard via Stripe', async ({ browser }) => {
    const page = await browser.newPage()
    await login(page)
    const uuid = await mkInvoice(page)
    expect(uuid).toBeTruthy()
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(3000)
    await expect(page.getByRole('button', { name: /Pay/ })).toBeVisible({
      timeout: 10000
    })
    await page.getByRole('button', { name: /Pay/ }).click()
    await page.waitForTimeout(300)
    await page.getByText('Credit card').first().click()
    await page.waitForTimeout(5000)
    expect(await completeStripePayment(page)).toBe(true)
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(5000)
    expect(
      /paid|betaald/i.test((await page.locator('body').textContent()) || '')
    ).toBe(true)
    await page.close()
  })
})

test.describe('Stripe Refunds', () => {
  test.setTimeout(600000)
  test('Refund via Stripe', async ({ browser }) => {
    const page = await browser.newPage()
    await login(page)
    const uuid = await mkBill(page)
    expect(uuid).toBeTruthy()

    // Edit pre-payment: €50 → €100
    await page.goto('/admin/bills')
    await page.waitForTimeout(3000)
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page.waitForTimeout(500)
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
    await page.waitForTimeout(2000)
    await page
      .locator('.q-dialog')
      .getByText(/1 x €50/)
      .first()
      .click()
    await page.waitForTimeout(1000)
    const pi = page
      .locator('.q-dialog')
      .getByRole('spinbutton', {
        name: /unit price|eenheidsprijs|list price|price/i
      })
      .first()
    await expect(pi).toBeVisible({ timeout: 10000 })
    await pi.fill('100.00')
    await page
      .locator('.q-dialog')
      .getByRole('button', { name: /done|ok|opslaan/i })
      .first()
      .click()
    await page.waitForTimeout(500)
    await page
      .locator('.q-dialog')
      .getByRole('button', { name: /submit|done|opslaan/i })
      .first()
      .click()
    await page.waitForTimeout(2000)

    // Pay
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(3000)
    await expect(page.getByRole('button', { name: /Pay/ })).toBeVisible({
      timeout: 10000
    })
    await page.getByRole('button', { name: /Pay/ }).click()
    await page.waitForTimeout(300)
    await page.getByText('Credit card').first().click()
    await page.waitForTimeout(5000)
    expect(await completeStripePayment(page)).toBe(true)

    // Edit post-payment: €100 → €50
    await page.goto('/admin/bills')
    await page.waitForTimeout(3000)
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page.waitForTimeout(500)
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
      await page.waitForTimeout(2000)
      await page
        .locator('.q-dialog')
        .getByText(/1 x €100/)
        .first()
        .click()
      await page.waitForTimeout(1000)
      const p2 = page
        .locator('.q-dialog')
        .getByRole('spinbutton', {
          name: /unit price|eenheidsprijs|list price|price/i
        })
        .first()
      await expect(p2).toBeVisible({ timeout: 10000 })
      await p2.fill('50.00')
      await page
        .locator('.q-dialog')
        .getByRole('button', { name: /done|ok|opslaan/i })
        .first()
        .click()
      await page.waitForTimeout(500)
      await page
        .locator('.q-dialog')
        .getByRole('button', { name: /submit|done|opslaan/i })
        .first()
        .click()
      await page.waitForTimeout(2000)
    } else {
      test.skip(true, 'Cannot edit PAID bill')
    }

    // Refund
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(3000)
    await expect(
      page.getByRole('button', { name: /refund|terugbetalen/i }).first()
    ).toBeVisible({ timeout: 10000 })
    await page
      .getByRole('button', { name: /refund|terugbetalen/i })
      .first()
      .click()
    await page.waitForTimeout(500)
    await page
      .locator('.q-dialog')
      .getByRole('button')
      .last()
      .click({ timeout: 5000 })
    await page.waitForTimeout(3000)
    await page.goto(`/invoice/${uuid}`)
    await page.waitForTimeout(2000)
    await expect(page.getByText(/refunded|terugbetaald/i).first()).toBeVisible({
      timeout: 30000
    })
    await page.close()
  })
})
