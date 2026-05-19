import { browser } from 'k6/browser'
import http from 'k6/http'
import { faker } from 'https://cdn.jsdelivr.net/npm/@faker-js/faker@10.4.0/dist/index.min.js'

export const createInvoiceLine = () => ({
  description: faker.commerce.productName(),
  discount: 0,
  listPrice: Math.round(Math.random() * 1e5),
  listPriceIncludesTax: true,
  quantity: 1,
  quantityPerMille: false,
  quantityUnit: null,
  taxRate: 21
})

export const email = 'admin@slimfact.app'
export const password = 'Sif5uEG5hcTH'
const baseUrl = 'https://localhost:3000'

export const options = {
  insecureSkipTLSVerify: true,
  scenarios: {
    test: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 10,
      options: {
        browser: {
          insecureSkipTLSVerify: true,
          type: 'chromium'
        }
      },
      startTime: '10s' // duration + gracefulStop of the above
    }
  },
  thresholds: {
    checks: ['rate==1.0']
  }
}

export interface AuthState {
  accessToken: string | null
}
let authState: AuthState

export async function login() {
  const page = await browser.newPage()
  let accessToken: string | null = null

  try {
    await page.goto(`${baseUrl}/`)
    await page.waitForLoadState('networkidle')

    const loginButton = page.locator('button', { hasText: 'Login' }).first()
    await loginButton.click()
    await page.waitForLoadState('networkidle')

    await page.getByText('Email', { exact: true }).fill(email)
    await page.getByText('Password', { exact: true }).fill(password)

    await page.locator('button', { hasText: 'Login' }).click()
    await page.waitForURL(/.*user/)

    accessToken = await page.evaluate(() => {
      return localStorage.getItem(
        btoa(
          'https://localhost:3000/oidc-slimfact-openid_profile_email_api-accessToken'
        )
      )
    })

    console.log('Access token acquired:', accessToken ? '***' : 'null')
  } finally {
    await page.close()
  }

  authState = { accessToken }
}

export default async function test() {
  await login()
  if (!authState?.accessToken) {
    throw new Error('No access token available')
  }

  try {
    const numberPrefixesRequest = http
      .get(`${baseUrl}/trpc/admin.getNumberPrefixes?input=%7B%7D`, {
        headers: {
          Authorization: `Bearer ${authState.accessToken}`
        }
      })
      .json()

    // console.log(numberPrefixesRequest)
    const numberPrefix = numberPrefixesRequest?.result.data[0]

    const companiesRequest = http
      .get(`${baseUrl}/trpc/admin.getCompanies`, {
        headers: {
          Authorization: `Bearer ${authState.accessToken}`
        }
      })
      .json()
    const companies = companiesRequest?.result?.data

    // console.log(companies)

    const clientsRequest = http
      .get(
        `${baseUrl}/trpc/admin.searchClients?input=%7B%0A%20%20%20%20%22name%22%3A%20null%0A%7D`,
        {
          headers: {
            Authorization: `Bearer ${authState.accessToken}`
          }
        }
      )
      .json()
    const clients = clientsRequest?.result.data

    // console.log(clients)
    const requests = []
    for (const client of clients) {
      const company = companies[Math.floor(Math.random() * companies.length)]

      for (let i = 0; i < Math.floor(Math.random() * 10); i++) {
        requests.push({
          method: 'POST',
          url: `${baseUrl}/trpc/admin.createInvoice`,
          body: JSON.stringify({
            companyDetails: company,
            clientDetails: client,
            companyPrefix: company.prefix,
            numberPrefixTemplate: numberPrefix.template,
            currency: 'EUR',
            lines: [createInvoiceLine()],
            discounts: [],
            surcharges: [],
            paymentTermDays: 14,
            locale: 'en-US',
            status: Math.random() > 0.2 ? 'bill' : undefined,
            companyId: company.id,
            clientId: client.id
          }),
          params: {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authState.accessToken}`
            }
          }
        })
      }
    }

    http.batch(requests)
  } finally {
  }
}
