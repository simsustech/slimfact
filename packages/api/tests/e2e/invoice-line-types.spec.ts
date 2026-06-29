/**
 * Simulates: petboarding booking update → manual slimfact line → booking re-update.
 *
 * Scenario:
 *  1. Petboarding creates/updates booking → slimfact invoice gets typed lines
 *  2. Admin manually adds a line in SlimFact (type: slimfact_manual)
 *  3. Petboarding recalculates costs → updateInvoice(replaceExistingLinesOfSameType: true)
 *  4. Manual line survives, petboarding lines replaced
 */
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

let page: Page

test.describe.configure({ mode: 'serial' })
test.setTimeout(120000)

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  await page.click('text=Login')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/.*login/)
  await page.locator('text="Email"').fill('admin@slimfact.app')
  await page.locator('text="Password"').fill('Sif5uEG5hcTH')
  await page.locator('button >> text=Login').click()
  await page.waitForURL(/.*user/)
  await expect(
    page
      .getByRole('tab', { name: 'Administrator' })
      .or(page.getByText('Administrator').locator(':scope.q-item__label'))
  ).toBeVisible()
})

test.beforeAll(async ({ request }) => {
  // Step 1: Petboarding creates invoice with booking + service lines
  const c = await request.post('/trpc/admin.createInvoice', {
    data: {
      companyId: 1,
      clientId: 1,
      numberPrefixTemplate: 'F{YYYY}{NNNN}',
      currency: 'EUR',
      locale: 'en-US',
      paymentTermDays: 14,
      lines: [
        {
          description: 'Pet boarding - Rex',
          listPrice: 5000,
          listPriceIncludesTax: true,
          quantity: 1000,
          quantityPerMille: true,
          discount: 0,
          taxRate: 21,
          type: 'petboarding_booking'
        },
        {
          description: 'Wash service',
          listPrice: 1000,
          listPriceIncludesTax: true,
          quantity: 1,
          quantityPerMille: false,
          discount: 0,
          taxRate: 21,
          type: 'petboarding_service'
        }
      ],
      status: 'bill'
    }
  })
  expect(c.ok()).toBeTruthy()
  const created = await c.json()
  const id = created.result?.data?.id || created.result?.id
  const uuid = created.result?.data?.uuid || created.result?.uuid

  // Verify petboarding-typed lines exist
  const g = await request.get(
    '/trpc/admin.getInvoice?batch=1&input=' +
      encodeURIComponent(JSON.stringify({ id }))
  )
  const inv = Array.isArray(await g.json())
    ? (await g.json())[0]
    : await g.json()
  const initialLines = inv.result?.data?.lines || inv.result?.lines || []
  expect(initialLines.map((l: any) => l.type)).toContain('petboarding_booking')
  expect(initialLines.map((l: any) => l.type)).toContain('petboarding_service')

  // Step 2: Admin manually adds a line in SlimFact
  await request.post('/trpc/admin.updateInvoice', {
    data: {
      id,
      uuid,
      companyId: 1,
      clientId: 1,
      numberPrefixTemplate: 'F{YYYY}{NNNN}',
      currency: 'EUR',
      locale: 'en-US',
      paymentTermDays: 14,
      lines: [
        {
          description: 'Pet boarding - Rex',
          listPrice: 5000,
          listPriceIncludesTax: true,
          quantity: 1000,
          quantityPerMille: true,
          discount: 0,
          taxRate: 21,
          type: 'petboarding_booking'
        },
        {
          description: 'Wash service',
          listPrice: 1000,
          listPriceIncludesTax: true,
          quantity: 1,
          quantityPerMille: false,
          discount: 0,
          taxRate: 21,
          type: 'petboarding_service'
        },
        {
          description: 'E2E manual line',
          listPrice: 2500,
          listPriceIncludesTax: true,
          quantity: 1,
          quantityPerMille: false,
          discount: 0,
          taxRate: 21,
          type: 'slimfact_manual'
        }
      ],
      status: 'bill'
    }
  })

  ;(globalThis as any).__id = id
  ;(globalThis as any).__uuid = uuid
})

test('manual line survives booking cost recalculation', async ({ request }) => {
  const id = (globalThis as any).__id
  const uuid = (globalThis as any).__uuid

  // Step 3: Petboarding recalculates costs → updateInvoice with replaceExistingLinesOfSameType
  //         (only petboarding_booking line, service removed, price changed)
  const u = await request.post('/trpc/admin.updateInvoice', {
    data: {
      id,
      uuid,
      companyId: 1,
      clientId: 1,
      numberPrefixTemplate: 'F{YYYY}{NNNN}',
      currency: 'EUR',
      locale: 'en-US',
      paymentTermDays: 14,
      lines: [
        {
          description: 'Pet boarding - Rex (updated)',
          listPrice: 6000,
          listPriceIncludesTax: true,
          quantity: 1000,
          quantityPerMille: true,
          discount: 0,
          taxRate: 21,
          type: 'petboarding_booking'
        }
      ],
      status: 'bill',
      replaceExistingLinesOfSameType: true
    }
  })
  expect(u.ok()).toBeTruthy()

  // Step 4: Verify
  const f = await request.get(
    '/trpc/admin.getInvoice?batch=1&input=' +
      encodeURIComponent(JSON.stringify({ id }))
  )
  const fi = Array.isArray(await f.json())
    ? (await f.json())[0]
    : await f.json()
  const lines = fi.result?.data?.lines || fi.result?.lines || []

  const descs = lines.map((l: any) => l.description)
  const types = lines.map((l: any) => l.type)

  // Manual line preserved
  expect(descs).toContain('E2E manual line')
  expect(types).toContain('slimfact_manual')
  // Petboarding line updated
  expect(descs).toContain('Pet boarding - Rex (updated)')
  expect(types).toContain('petboarding_booking')
  // Old service line replaced
  expect(descs).not.toContain('Wash service')
})
