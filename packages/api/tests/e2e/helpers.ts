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
  for (const name of ['Company*', 'Client*', 'Number prefix*']) {
    await p.getByLabel(name).click()
    await p.waitForSelector('[role="listbox"]', { timeout: 10000 })
    await p.getByRole('option').first().click()
    if (name !== 'Number prefix*') {
      await p
        .getByRole('listbox')
        .first()
        .waitFor({ state: 'hidden', timeout: 5000 })
        .catch(() => {})
    }
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

export async function mkInvoice(p: Page) {
  await p.goto('/admin/invoices')
  await p.waitForLoadState('networkidle')
  await p.locator('#fabAdd').click({ force: true })
  await fillComboboxes(p)
  await clickLinesAdd(p)
  await p.getByRole('textbox', { name: 'Description' }).fill('E2E')
  const unitPrice = p.getByRole('spinbutton', { name: 'Unit price' }).first()
  await unitPrice.evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set
    setter?.call(el, '50.00')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await p.getByRole('button', { name: 'Done' }).click()
  await p.getByRole('button', { name: 'Submit' }).click()
  await expect(p.getByText('€50.00').first()).toBeVisible({ timeout: 10000 })
  await p.goto('/admin/invoices')
  await p.waitForLoadState('networkidle')
  await p.locator('.q-expansion-item__toggle-icon').first().click()
  await p
    .locator('.q-expansion-item__content')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
  await moreBtn(p)
  const so = p.getByText('Send').first()
  if (await so.isVisible().catch(() => false)) await so.click()
  const subj = p.locator('.q-dialog input[type="text"]').first()
  if (await subj.isVisible()) {
    await subj.waitFor({ state: 'visible', timeout: 5000 })
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
