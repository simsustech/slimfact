import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { Kysely, PostgresDialect, CamelCasePlugin } from 'kysely'
import pg from 'pg'
import type { DB } from '../../src/kysely/types.js'

/** Seeded admin credentials (created by seed:test / the demo world). */
export const ADMIN_EMAIL = 'admin@slimfact.app'
export const ADMIN_PASSWORD = 'Sif5uEG5hcTH'

/**
 * Read-only Kysely handle on the stack's `slimfact` database for asserting
 * seeded state. E2E specs never write through this — mutations go via the UI.
 * Each call gets an INDEPENDENT pool+handle so a spec's `db.destroy()` in its
 * finally-block cannot break other specs' connections.
 */
export const getTestDb = () => {
  const pool = new pg.Pool({
    connectionString:
      process.env.TEST_DATABASE_URL ||
      'postgres://postgres:ufgouifdgjdfg@localhost:5433/slimfact',
    max: 2
  })
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin()]
  })
}
export async function dumpPage(page: Page, label: string) {
  console.log(`\n=== ${label} ===`)
  console.log('URL:', page.url())

  const buttons = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll('button, [role="button"], a[href]')
    ).map((e) => ({
      tag: e.tagName,
      text: e.textContent?.trim().substring(0, 50),
      type: e.getAttribute('type'),
      role: e.getAttribute('role'),
      href: e.getAttribute('href')?.substring(0, 80),
      visible: (e as HTMLElement).offsetParent !== null,
      rect: (() => {
        const r = e.getBoundingClientRect()
        return `${Math.round(r.width)}x${Math.round(r.height)}`
      })()
    }))
  )
  console.log(
    `Buttons (${buttons.length}):`,
    JSON.stringify(buttons, null, 2).substring(0, 2000)
  )

  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input, textarea, select')).map(
      (e) => ({
        name: e.getAttribute('name') || '',
        type: e.getAttribute('type') || e.tagName,
        placeholder: e.getAttribute('placeholder') || '',
        value: (e as HTMLInputElement).value?.substring(0, 30) || ''
      })
    )
  )
  console.log(
    `Inputs (${inputs.length}):`,
    JSON.stringify(inputs, null, 2).substring(0, 1000)
  )

  const text = await page.locator('body').textContent()
  console.log('Body text:', text?.substring(0, 1500))
}

export const moreBtn = async (p: Page) => {
  const btn = p
    .locator('.q-expansion-item')
    .first()
    .locator('button')
    .filter({ has: p.locator('.i-mdi-more-vert, .i-mdi-dots-vertical') })
    .first()
  await btn.waitFor({ state: 'visible', timeout: 10000 })
  await btn.click()
  await p.locator('.q-menu, .q-popup-edit, [role="menu"]').first().waitFor({
    state: 'visible',
    timeout: 5000
  })
}

export async function fillComboboxes(p: Page) {
  // The create dialog's entrance animation steals the first QSelect menu-open
  // event (and poisons that select's toggle state). Let the transition finish
  // before interacting — clicking earlier permanently breaks the first menu.
  const dialog = p.locator('.q-dialog').first()
  if ((await dialog.count()) > 0) {
    // Empirically the dialog's enter transition needs ~1.5-2s after visible
    // before QSelect clicks register; earlier clicks poison the first select.
    await p.waitForTimeout(1_800)
  }
  for (const name of ['Company*', 'Client*', 'Number prefix*']) {
    // event to the dialog's focus handling — retry until the listbox appears.
    const combo = p.getByLabel(name)
    await combo.waitFor({ state: 'visible', timeout: 10_000 })
    // Downstream selects stay disabled until upstream picks land (e.g.
    // Number prefix needs a companyId) — wait for enablement too.
    await expect(combo).toBeEnabled({ timeout: 20_000 })
    let opened = false
    for (let attempt = 0; attempt < 6 && !opened; attempt++) {
      if (attempt > 0) {
        // A premature first click can leave the QSelect convinced its menu is
        // open, so later clicks toggle it closed — reset before retrying.
        await combo.press('Escape').catch(() => {})
        await p.waitForTimeout(250)
      }
      await combo.click()
      if (attempt % 2 === 1) {
        // Click-to-open is unreliable inside dialogs across Quasar builds;
        // the keyboard route always opens the menu.
        await combo.press('ArrowDown').catch(() => {})
      }
      opened = await p
        .waitForSelector('[role="listbox"]', { timeout: 1_500 })
        .then(() => true)
        .catch(() => false)
    }
    if (!opened) {
      throw new Error(
        `fillComboboxes: listbox for "${name}" did not open after retries`
      )
    }
    // Pick the first option (the original helper contract), then let the
    // menu close before moving on — including after the last select, or the
    // open listbox intercepts subsequent form interactions.
    await p.getByRole('option').first().click()
    await p
      .locator('[role="listbox"]')
      .first()
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .catch(() => {})
  }
}

export async function clickLinesAdd(p: Page) {
  await p.evaluate(() => {
    const lists = Array.from(document.querySelectorAll('[role="list"]'))
    for (const list of lists) {
      if (
        list.textContent?.includes('Lines') &&
        list.textContent?.includes('Add')
      ) {
        const item = list.querySelector(
          '[role="listitem"]'
        ) as HTMLElement | null
        // Fall back to any clickable "Add" row inside the list
        const addRow =
          item ??
          (Array.from(list.querySelectorAll('[role="listitem"], .q-item')).find(
            (e) => e.textContent?.trim() === 'Add'
          ) as HTMLElement | null)
        addRow?.click()
        return
      }
    }
  })
}

export async function mkInvoice(
  p: Page,
  options: { amount?: string; paymentTermDays?: number } = {}
) {
  await p.goto('/admin/invoices')
  await p.waitForLoadState('networkidle')
  await p.locator('#fabAdd').click({ force: true })
  await fillComboboxes(p)
  await clickLinesAdd(p)
  await p.getByRole('textbox', { name: 'Description' }).fill('E2E')
  if (options.paymentTermDays !== undefined) {
    const term = p.getByRole('spinbutton', { name: /payment term/i })
    await term.evaluate((el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      setter?.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, String(options.paymentTermDays))
  }
  const unitPrice = p.getByRole('spinbutton', { name: 'Unit price' }).first()
  await unitPrice.evaluate((el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set
    setter?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, options.amount ?? '50.00')
  await p.getByRole('button', { name: 'Done' }).click()
  await p.getByRole('button', { name: 'Submit' }).click()
  await expect(
    p.getByText(`€${options.amount ?? '50.00'}`).first()
  ).toBeVisible({
    timeout: 10000
  })
  await p.goto('/admin/invoices')
  await p.waitForLoadState('networkidle')
  await p.locator('.q-expansion-item__toggle-icon').first().click()
  await p
    .locator('.q-expansion-item__content')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
  await moreBtn(p)
  const so = p.getByText('Send').first()
  // The expansion menu renders async — wait for the item instead of probing
  // it instantly, or the send is skipped and the invoice stays CONCEPT.
  await so.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  if (await so.isVisible().catch(() => false)) await so.click()
  // The send dialog mounts after the menu item click — wait for it before
  // filling the subject, otherwise the required subject is left empty and the
  // send never fires.
  const subj = p.locator('.q-dialog input[type="text"]').first()
  await subj.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  if (await subj.isVisible()) {
    await subj.fill('Invoice')
  }
  const body = p.locator('.q-dialog textarea').first()
  if (await body.isVisible()) await body.fill('.')
  await p.getByRole('button', { name: 'Send' }).click({ timeout: 3000 })
  await p
    .locator('.q-notification, .q-banner')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {})
  await p.goto('/admin/invoices')
  await p.waitForLoadState('networkidle')
  await p.locator('.q-expansion-item__toggle-icon').first().click()
  await p
    .locator('.q-expansion-item__content')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
  await moreBtn(p)
  const lnk = p.locator('a').filter({ hasText: 'Open' }).first()
  let uuid = ''
  if (await lnk.isVisible({ timeout: 3000 }).catch(() => false))
    uuid = (await lnk.getAttribute('href'))?.replace('/invoice/', '') || ''
  await p.keyboard.press('Escape')
  return uuid
}

export async function mkBill(p: Page) {
  await p.goto('/admin/bills')
  await p.waitForLoadState('networkidle')
  await p.locator('#fabAdd').click({ force: true })
  await fillComboboxes(p)
  await clickLinesAdd(p)
  const billUnitPrice = p
    .getByRole('spinbutton', { name: 'Unit price' })
    .first()
  await billUnitPrice.evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set
    setter?.call(el, '50.00')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await p
    .getByRole('button', { name: 'Done' })
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {})
  await p.getByRole('button', { name: 'Done' }).first().click()
  await p.getByRole('button', { name: 'Submit' }).first().click()
  await expect(p.getByText('€50.00').first()).toBeVisible({ timeout: 10000 })
  // Re-navigate so the bill list refetches before we look for the new bill
  await p.goto('/admin/bills')
  await p.waitForLoadState('networkidle')
  // Wait for the list to actually render the new bill
  await p
    .locator('.q-expansion-item')
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
  await p.locator('.q-expansion-item__toggle-icon').first().click()
  await p
    .locator('.q-expansion-item__content')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
  await moreBtn(p)
  const lnk = p.locator('a').filter({ hasText: 'Open' }).first()
  let uuid = ''
  if (await lnk.isVisible({ timeout: 15000 }).catch(() => false))
    uuid = (await lnk.getAttribute('href'))?.replace('/invoice/', '') || ''
  await p.keyboard.press('Escape')
  return uuid
}
