import { type Browser, expect, Page } from '@playwright/test'
import { applyAuthState, readAuthState } from './auth-state'

export const initializePage = async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({
    serviceWorkers: 'block',
    ignoreHTTPSErrors: true
  })
  const page = await context.newPage()

  page.on('pageerror', (exception) => {
    console.log(`Uncaught exception: "${exception}"`)
  })

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`Console error: "${msg.text()}"`)
    }
  })

  return page
}

export const login = async ({
  page,
  email,
  password
}: {
  page: Page
  email: string
  password: string
}) => {
  // Replay the state global-setup captured for this email, when present; the
  // full OIDC flow is the fallback (first run, or a state file that was not
  // written). Replay skips the round-trip that dominated the per-test cost.
  const state = readAuthState(email)
  if (state) {
    await applyAuthState(page, state)
    return
  }

  await page.goto('/')

  await page.click('text=Login')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveURL(/.*login/)

  await page.locator('text="Email"').fill(email)
  await page.locator('text="Password"').fill(password)

  await page.locator('button >> text=Login').click()

  await page.waitForURL(/.*user/)

  return
}
