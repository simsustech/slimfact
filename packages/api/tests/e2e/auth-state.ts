import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Browser, type Page } from '@playwright/test'

/**
 * Reusable logins: every test would otherwise pay the full OIDC round-trip in
 * `login()`. `global-setup` signs the seeded admin in once and writes its
 * `storageState` here; `login()` replays the saved state instead.
 *
 * The state holds the OIDC `_session` / `_interaction` cookies *and* the
 * lionel client's localStorage tokens (the production build uses
 * `tokenStorage: 'local'`), so both have to be replayed.
 */
const AUTH_DIR = join(import.meta.dirname, '.auth')

// `global-setup` has no test `use.baseURL`, so the helper navigates by
// absolute URL.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://slimfact.localhost'

/** The seeded admin every spec signs in as. */
export const E2E_ADMIN = {
  email: 'admin@slimfact.app',
  password: 'Sif5uEG5hcTH'
} as const

interface AuthCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: 'Strict' | 'Lax' | 'None'
}

export interface AuthState {
  cookies: AuthCookie[]
  origins: {
    origin: string
    localStorage: { name: string; value: string }[]
  }[]
}

const slug = (email: string) => email.replace(/[^a-zA-Z0-9]+/g, '-')

const statePath = (email: string) => join(AUTH_DIR, `${slug(email)}.json`)

/** The saved state for `email`, or `null` when it has not been captured. */
export function readAuthState(email: string): AuthState | null {
  const path = statePath(email)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as AuthState
  } catch {
    return null
  }
}

/** Sign `email` in through the UI and persist its state for later runs. */
export async function saveAuthState(
  browser: Browser,
  email: string,
  password: string
) {
  const context = await browser.newContext({
    serviceWorkers: 'block',
    ignoreHTTPSErrors: true
  })
  const page = await context.newPage()

  await page.goto(BASE_URL)
  await page.click('text=Login')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/.*login/)
  await page.locator('text="Email"').fill(email)
  await page.locator('text="Password"').fill(password)
  await page.locator('button >> text=Login').click()
  await page.waitForURL(/.*user/)

  mkdirSync(AUTH_DIR, { recursive: true })
  await context.storageState({ path: statePath(email) })
  await context.close()
}

/** Replay a saved state onto an existing page's context, then land in the app. */
export async function applyAuthState(page: Page, state: AuthState) {
  await page.context().addCookies(state.cookies)
  await page.addInitScript((s: AuthState) => {
    // Run once per tab: a test that signs out must stay signed out.
    if (sessionStorage.getItem('__e2eAuthApplied') === '1') return
    sessionStorage.setItem('__e2eAuthApplied', '1')
    for (const origin of s.origins ?? []) {
      for (const item of origin.localStorage ?? []) {
        try {
          localStorage.setItem(item.name, item.value)
        } catch {
          // ignore storage failures (e.g. private mode)
        }
      }
    }
  }, state)

  // Land where the full flow ends (`login()` waits for `/user`).
  await page.goto(`${BASE_URL}/user`)
  // The full flow reached `/user` through the SPA, so its shell was already
  // mounted; a direct goto can resolve first, so wait for the drawer before
  // tests probe the layout.
  await page
    .locator('.q-drawer')
    .first()
    .waitFor({ state: 'attached', timeout: 15_000 })
    .catch(() => undefined)
}
