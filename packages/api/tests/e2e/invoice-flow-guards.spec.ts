import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

let page: Page
let token: string
let ids: Record<string, number> = {}

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
  await expect(page.getByText('Administrator').first()).toBeAttached()

  token = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (atob(key).includes('accessToken'))
        return localStorage.getItem(key) || ''
    }
    return ''
  })
  expect(token).toBeTruthy()
})

test.afterAll(async () => {
  await page.close()
})

const headers = () => ({ Authorization: `Bearer ${token}` })

async function trpc(path: string, input?: any) {
  const res = await page.request.post(`/trpc/${path}`, {
    data: input,
    headers: headers()
  })
  return res.json()
}

test('Create test invoices', async () => {
  for (const status of ['bill', 'open']) {
    const json = await trpc('admin.createInvoice', {
      companyId: 1,
      clientId: 1,
      currency: 'EUR',
      paymentTermDays: 14,
      numberPrefixTemplate: '{year}-{num}',
      locale: 'en-US',
      lines: [
        {
          description: 't',
          listPrice: 1000,
          listPriceIncludesTax: true,
          quantity: 1,
          quantityPerMille: false,
          taxRate: 21,
          discount: 0
        }
      ],
      discounts: [],
      surcharges: [],
      status
    })
    expect(json.error).toBeUndefined()
    ids[status] = json.result.data.id
  }
  // Create concept (no status = defaults to concept)
  const json = await trpc('admin.createInvoice', {
    companyId: 1,
    clientId: 1,
    currency: 'EUR',
    paymentTermDays: 14,
    numberPrefixTemplate: '{year}-{num}',
    locale: 'en-US',
    lines: [
      {
        description: 't',
        listPrice: 1000,
        listPriceIncludesTax: true,
        quantity: 1,
        quantityPerMille: false,
        taxRate: 21,
        discount: 0
      }
    ],
    discounts: [],
    surcharges: []
  })
  expect(json.error).toBeUndefined()
  ids.concept = json.result.data.id
  console.log('IDs:', JSON.stringify(ids))
})

test('BILL → OPEN blocked', async () => {
  const json = await trpc('admin.setInvoiceStatus', {
    id: ids.bill,
    status: 'open'
  })
  expect(json.result.data.success).toBe(false)
  expect(json.result.data.errorMessage).toContain('concept')
})

test('CONCEPT → RECEIPT blocked', async () => {
  const json = await trpc('admin.setInvoiceStatus', {
    id: ids.concept,
    status: 'receipt'
  })
  expect(json.result.data.success).toBe(false)
  expect(json.result.data.errorMessage).toContain('bills')
})

test('OPEN → CANCELED blocked', async () => {
  const json = await trpc('admin.setInvoiceStatus', {
    id: ids.open,
    status: 'canceled'
  })
  expect(json.result.data.success).toBe(false)
  expect(json.result.data.errorMessage).toContain('cancel')
})

test('CONCEPT → CANCELED allowed', async () => {
  const json = await trpc('admin.setInvoiceStatus', {
    id: ids.concept,
    status: 'canceled'
  })
  expect(json.result.data.success).toBe(true)
})
