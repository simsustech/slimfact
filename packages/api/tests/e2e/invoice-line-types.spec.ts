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
      try {
        if (atob(key).endsWith('accessToken'))
          return localStorage.getItem(key) || ''
      } catch {
        continue
      }
    }
    return ''
  })
  expect(token).toBeTruthy()
})

test.afterAll(async () => {
  await page.close()
})
const headers = () => ({ Authorization: `Bearer ${token}` })

let invoiceId: number
let invoiceUuid: string

test.beforeAll(async () => {
  const c = await page.request.post('/trpc/admin.createInvoice', {
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
    },
    headers: headers()
  })
  expect(c.ok()).toBeTruthy()
  const created = await c.json()
  invoiceId = created.result?.data?.id || created.result?.id
  invoiceUuid = created.result?.data?.uuid || created.result?.uuid

  await page.request.post('/trpc/admin.updateInvoice', {
    data: {
      id: invoiceId,
      uuid: invoiceUuid,
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
        },
        // A line of a *foreign* family: the replacement below only claims the
        // 'petboarding' family, so this one has to survive it.
        {
          description: 'Alien line',
          listPrice: 500,
          listPriceIncludesTax: true,
          quantity: 1,
          quantityPerMille: false,
          discount: 0,
          taxRate: 21,
          type: 'acme_other'
        }
      ],
      status: 'bill'
    },
    headers: headers()
  })
})

test('replaceTypedLines rewrites the whole owned family and keeps the rest', async () => {
  const u = await page.request.post('/trpc/admin.updateInvoice', {
    data: {
      id: invoiceId,
      uuid: invoiceUuid,
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
      replaceTypedLines: 'petboarding'
    },
    headers: headers()
  })
  expect(u.ok()).toBeTruthy()

  const f = await page.request.get(
    '/trpc/admin.getInvoice?input=' +
      encodeURIComponent(JSON.stringify({ id: invoiceId })),
    { headers: headers() }
  )
  const fi = Array.isArray(await f.json())
    ? (await f.json())[0]
    : await f.json()
  const fl = fi.result?.data?.lines || fi.result?.lines || []
  const descriptions = fl.map((l: any) => l.description)
  const types = fl.map((l: any) => l.type)

  // The payload owns the family: its line is here exactly once, the *old* one
  // is gone (no duplicate), and so is the family member the payload no longer
  // sends — that is the defect the old flag left behind (a removed service, a
  // cancelation that voids the booking lines).
  expect(
    descriptions.filter((d: string) => d === 'Pet boarding - Rex (updated)')
  ).toHaveLength(1)
  expect(descriptions).not.toContain('Pet boarding - Rex')
  expect(descriptions).not.toContain('Wash service')
  expect(types.filter((t: string) => t === 'petboarding_booking')).toHaveLength(
    1
  )
  expect(types).not.toContain('petboarding_service')

  // Everything the caller does not own survives: the manually added line and
  // the foreign family.
  expect(descriptions).toContain('E2E manual line')
  expect(descriptions).toContain('Alien line')
  expect(types).toContain('slimfact_manual')
  expect(types).toContain('acme_other')
})

test('without replaceTypedLines the payload becomes the invoice lines', async () => {
  const u = await page.request.post('/trpc/admin.updateInvoice', {
    data: {
      id: invoiceId,
      uuid: invoiceUuid,
      companyId: 1,
      clientId: 1,
      numberPrefixTemplate: 'F{YYYY}{NNNN}',
      currency: 'EUR',
      locale: 'en-US',
      paymentTermDays: 14,
      lines: [
        {
          description: 'Payload alone',
          listPrice: 100,
          listPriceIncludesTax: true,
          quantity: 1,
          quantityPerMille: false,
          discount: 0,
          taxRate: 21,
          type: 'petboarding_booking'
        }
      ],
      status: 'bill'
    },
    headers: headers()
  })
  expect(u.ok()).toBeTruthy()

  const f = await page.request.get(
    '/trpc/admin.getInvoice?input=' +
      encodeURIComponent(JSON.stringify({ id: invoiceId })),
    { headers: headers() }
  )
  const fi = Array.isArray(await f.json())
    ? (await f.json())[0]
    : await f.json()
  const fl = fi.result?.data?.lines || fi.result?.lines || []

  // No matcher is the documented default (the former `false`): the payload is
  // authoritative for the whole invoice, manual lines included.
  expect(fl.map((l: any) => l.description)).toEqual(['Payload alone'])
})
