import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

let page: Page
let token: string

test.describe.configure({ mode: 'serial' })
test.setTimeout(120000)

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  await page.click('text=Login')
  await page.waitForURL(/.*login/)
  await page.locator('text="Email"').fill('admin@slimfact.app')
  await page.locator('text="Password"').fill('Sif5uEG5hcTH')
  await page.locator('button >> text=Login').click()
  await page.waitForURL(/.*user/)
  await expect(page.getByText('Administrator').first()).toBeAttached()

  token = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (atob(key).includes('accessToken')) return localStorage.getItem(key) || ''
    }
    return ''
  })
  expect(token).toBeTruthy()
})

const headers = () => ({ Authorization: `Bearer ${token}` })

let invoiceId: number
let invoiceUuid: string

test.beforeAll(async () => {
  const c = await page.request.post('/trpc/admin.createInvoice', {
    data: {
      companyId: 1, clientId: 1,
      numberPrefixTemplate: 'F{YYYY}{NNNN}', currency: 'EUR', locale: 'en-US', paymentTermDays: 14,
      lines: [
        { description: 'Pet boarding - Rex', listPrice: 5000, listPriceIncludesTax: true, quantity: 1000, quantityPerMille: true, discount: 0, taxRate: 21, type: 'petboarding_booking' },
        { description: 'Wash service', listPrice: 1000, listPriceIncludesTax: true, quantity: 1, quantityPerMille: false, discount: 0, taxRate: 21, type: 'petboarding_service' }
      ],
      status: 'bill'
    },
    headers: headers()
  })
  expect(c.ok()).toBeTruthy()
  const created = await c.json()
  invoiceId = created.result?.data?.id || created.result?.id
  invoiceUuid = created.result?.data?.uuid || created.result?.uuid

  await page.request.post('/trpc/admin.updateInvoice', {
    data: {
      id: invoiceId, uuid: invoiceUuid,
      companyId: 1, clientId: 1, numberPrefixTemplate: 'F{YYYY}{NNNN}', currency: 'EUR', locale: 'en-US', paymentTermDays: 14,
      lines: [
        { description: 'Pet boarding - Rex', listPrice: 5000, listPriceIncludesTax: true, quantity: 1000, quantityPerMille: true, discount: 0, taxRate: 21, type: 'petboarding_booking' },
        { description: 'Wash service', listPrice: 1000, listPriceIncludesTax: true, quantity: 1, quantityPerMille: false, discount: 0, taxRate: 21, type: 'petboarding_service' },
        { description: 'E2E manual line', listPrice: 2500, listPriceIncludesTax: true, quantity: 1, quantityPerMille: false, discount: 0, taxRate: 21, type: 'slimfact_manual' }
      ],
      status: 'bill'
    },
    headers: headers()
  })
})

test('manual line survives replaceExistingLinesOfSameType', async () => {
  const u = await page.request.post('/trpc/admin.updateInvoice', {
    data: {
      id: invoiceId, uuid: invoiceUuid,
      companyId: 1, clientId: 1, numberPrefixTemplate: 'F{YYYY}{NNNN}', currency: 'EUR', locale: 'en-US', paymentTermDays: 14,
      lines: [
        { description: 'Pet boarding - Rex (updated)', listPrice: 6000, listPriceIncludesTax: true, quantity: 1000, quantityPerMille: true, discount: 0, taxRate: 21, type: 'petboarding_booking' }
      ],
      status: 'bill',
      replaceExistingLinesOfSameType: true
    },
    headers: headers()
  })
  expect(u.ok()).toBeTruthy()

  const f = await page.request.get('/trpc/admin.getInvoice?input=' + encodeURIComponent(JSON.stringify({ id: invoiceId })), { headers: headers() })
  const fi = Array.isArray(await f.json()) ? (await f.json())[0] : await f.json()
  const fl = fi.result?.data?.lines || fi.result?.lines || []

  expect(fl.map((l: any) => l.description)).toContain('E2E manual line')
  expect(fl.map((l: any) => l.description)).toContain('Pet boarding - Rex (updated)')
  expect(fl.map((l: any) => l.description)).toContain('Wash service')
  expect(fl.map((l: any) => l.type)).toContain('slimfact_manual')
  expect(fl.map((l: any) => l.type)).toContain('petboarding_booking')
})
