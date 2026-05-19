import { browser, Locator } from 'k6/browser'
import { faker } from 'https://cdn.jsdelivr.net/npm/@faker-js/faker@10.4.0/dist/index.min.js'

const email = faker.internet.email()
const password = faker.internet.password()

const baseUrl = 'https://localhost:3000'

export const options = {
  insecureSkipTLSVerify: true,
  scenarios: {
    test: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 100,
      options: {
        browser: {
          discardResponseBodies: true,
          insecureSkipTLSVerify: true,
          type: 'chromium'
        }
      }
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function login() {
  const page = await browser.newPage()
  let accessToken: string | null = null

  try {
    async function dragAndDrop(locatorToDrag: Locator) {
      const toDragBox = await locatorToDrag.boundingBox()

      await locatorToDrag.hover()
      await page.mouse.down()
      delay(200)
      await page.mouse.move(
        toDragBox!.x + 300,
        toDragBox!.y + toDragBox!.height / 2
      )
      await page.mouse.up()
    }

    await page.goto(`${baseUrl}/`)

    const loginButton = page.locator('button', { hasText: 'Login' }).first()
    await loginButton.click()

    await page.waitForLoadState('networkidle')
    const registerButton = page
      .locator('span', { hasText: 'Create account' })
      .first()
    await registerButton.click()

    await delay(200)
    await page.getByText('Email', { exact: true }).fill(email)
    await page.getByText('Password', { exact: true }).fill(password)
    await page.getByText('Repeat password', { exact: true }).fill(password)
    const slider = page.locator('.q-slider__thumb')

    await dragAndDrop(slider)

    await page.locator('button', { hasText: 'Submit' }).click()

    await page.locator('button', { hasText: 'Ok' }).click()

    await page.waitForURL(/.*login/)

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
  } finally {
  }
}
