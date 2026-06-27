import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

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
      visible: !(e as HTMLElement).offsetParent === null,
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
    .filter({ has: p.locator('.i-mdi-more-vert') })
    .first()
  await btn.waitFor({ state: 'visible', timeout: 10000 })
  await btn.click()
  await p.waitForTimeout(300)
}

async function fillComboboxes(p: Page) {
  for (const name of ['Company*', 'Client*', 'Number prefix*']) {
    // Open the combobox
    await p.getByRole('combobox', { name }).click()
    // Wait for the dropdown with options
    await p.waitForSelector('[role="listbox"] [role="option"]', {
      timeout: 5000
    })
    // Click first option via evaluate to avoid timing issues
    await p.evaluate(() => {
      const opts = document.querySelectorAll('[role="listbox"] [role="option"]')
      if (opts.length) (opts[0] as HTMLElement).click()
    })
    // Close the dropdown for all except the last combobox
    if (name !== 'Number prefix*') {
      await p.getByRole('toolbar').first().click({ force: true })
      await p
        .getByRole('listbox')
        .first()
        .waitFor({ state: 'hidden', timeout: 5000 })
        .catch(() => {})
    }
    await p.waitForTimeout(300)
  }
}

export async function mkInvoice(p: Page) {
  await p.goto('/admin/invoices')
  await p.waitForTimeout(3000)
  await p.locator('#fabAdd').click({ force: true })
  await fillComboboxes(p)
  await p
    .getByRole('list')
    .filter({ hasText: 'Lines Add' })
    .getByRole('listitem')
    .click()
  await p.getByRole('textbox', { name: 'Description' }).fill('E2E')
  await p.getByRole('spinbutton', { name: 'Unit price' }).fill('50.00')
  await p.getByRole('button', { name: 'Done' }).click()
  await p.getByRole('button', { name: 'Submit' }).click()
  await expect(p.getByText('€50.00').first()).toBeVisible({ timeout: 10000 })
  await p.locator('.q-expansion-item__toggle-icon').first().click()
  await p.waitForTimeout(300)
  await moreBtn(p)
  const so = p.getByText('Send').first()
  if (await so.isVisible().catch(() => false)) await so.click()
  await p.waitForTimeout(500)
  const subj = p.locator('.q-dialog input[type="text"]').first()
  if (await subj.isVisible()) await subj.fill('Invoice')
  const body = p.locator('.q-dialog textarea').first()
  if (await body.isVisible()) await body.fill('.')
  await p.getByRole('button', { name: 'Send' }).click({ timeout: 3000 })
  await p.waitForTimeout(1500)
  await p.goto('/admin/invoices')
  await p.waitForTimeout(3000)
  await p.locator('.q-expansion-item__toggle-icon').first().click()
  await p.waitForTimeout(300)
  await moreBtn(p)
  const lnk = p.locator('a').filter({ hasText: 'Open' }).first()
  let uuid = ''
  if (await lnk.isVisible({ timeout: 3000 }).catch(() => false))
    uuid = (await lnk.getAttribute('href'))?.replace('/invoice/', '') || ''
  await p.keyboard.press('Escape')
  await p.waitForTimeout(200)
  return uuid
}

export async function mkBill(p: Page) {
  await p.goto('/admin/bills')
  await p.waitForTimeout(3000)
  await p.locator('#fabAdd').click({ force: true })
  await fillComboboxes(p)
  await p
    .getByRole('list')
    .filter({ hasText: 'Lines Add' })
    .getByRole('listitem')
    .click()
  await p.getByRole('textbox', { name: 'Description' }).fill('E2E')
  await p.getByRole('spinbutton', { name: 'Unit price' }).fill('50.00')
  await p.getByRole('button', { name: 'Done' }).click()
  await p.getByRole('button', { name: 'Submit' }).click()
  await expect(p.getByText('€50.00').first()).toBeVisible({ timeout: 10000 })
  await p.locator('.q-expansion-item__toggle-icon').first().click()
  await p.waitForTimeout(300)
  await moreBtn(p)
  const lnk = p.locator('a').filter({ hasText: 'Open' }).first()
  let uuid = ''
  if (await lnk.isVisible({ timeout: 3000 }).catch(() => false))
    uuid = (await lnk.getAttribute('href'))?.replace('/invoice/', '') || ''
  await p.keyboard.press('Escape')
  await p.waitForTimeout(200)
  return uuid
}
