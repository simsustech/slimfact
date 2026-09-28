import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { clickLinesAdd, moreBtn } from './helpers'
import { login } from './setup'

const email = 'admin@slimfact.app'
const password = 'Sif5uEG5hcTH'

let page: Page

test.describe.configure({ mode: 'serial' })

// Fresh page per test — same reasoning as invoice-flow.spec.ts: a reused page
// breaks the second create dialog (Lines section never renders).
test.beforeEach(async ({ browser }) => {
  page = await browser.newPage()
  await login({ page, email, password })
})

test.afterEach(async () => {
  // test.info() instead of the fixtures param: Playwright mandates the object
  // destructuring pattern for a first param, which oxlint flags as empty.
  const testInfo = test.info()
  if (testInfo.status !== testInfo.expectedStatus) {
    await page.screenshot({
      path: testInfo.outputPath('failure.png'),
      fullPage: true
    })
  }
  await page.close()
})

/**
 * Open the create-invoice dialog and wait for the entrance transition —
 * the same settle time fillComboboxes uses: a click during the transition
 * poisons the first QSelect's toggle state.
 */
async function openCreateDialog() {
  await page.goto('/admin/invoices')
  await page.waitForLoadState('networkidle')
  await page.locator('#fabAdd').click()
  await page.locator('.q-dialog').waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForTimeout(1_800)
}

/**
 * Open a QSelect by clicking its control via the DOM (sidesteps the
 * viewport/fight-the-dialog-scroll issues Playwright's click has with tall
 * fixed Quasar dialogs — see helpers.fillComboboxes), then verify the
 * listbox actually opened. A premature click leaves QSelect convinced its
 * menu is open, so later clicks toggle it closed — reset with Escape and
 * retry, same as fillComboboxes.
 */
async function openSelect(label: string, expectOptions = true) {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) {
      await selectInput(label)
        .press('Escape')
        .catch(() => {})
      await page.waitForTimeout(250)
    }
    await page.evaluate((n) => {
      const fields = Array.from(
        document.querySelectorAll('.q-field')
      ) as HTMLElement[]
      const field = fields.find(
        (f) =>
          f.getAttribute('aria-label') === n ||
          f.querySelector(`[aria-label="${n}"]`) !== null
      )
      const control = field?.querySelector('.q-field__control')
      if (control) {
        // QSelect opens on mousedown; a bare click event is not enough.
        for (const type of ['mousedown', 'mouseup', 'click']) {
          control.dispatchEvent(
            new MouseEvent(type, { bubbles: true, cancelable: true })
          )
        }
      }
    }, label)
    if (!expectOptions) return
    try {
      await expect(page.getByRole('option').first()).toBeVisible({
        timeout: 2_000
      })
      return
    } catch {
      // retry — toggle state was desynced
    }
  }
  throw new Error(
    `openSelect: listbox for "${label}" did not open after retries`
  )
}

/**
 * QSelect puts aria-label on its focus-target INPUT — so getByLabel returns
 * the input itself (no nested `input` to search for). use-input=false renders
 * it readonly instead of removing it, so typing tests must assert readonly.
 */
function selectInput(label: string) {
  return page.locator('.q-dialog').getByLabel(label).first()
}

async function expectTypable(label: string) {
  const input = selectInput(label)
  await expect(input, `${label}: input must be visible`).toBeVisible({
    timeout: 3_000
  })
  await expect(
    input,
    `${label}: input must not be readonly (use-input on)`
  ).not.toHaveAttribute('readonly', /.+/)
  return input
}

async function dumpSelectState(label: string) {
  const state = await page.evaluate((n) => {
    const fields = Array.from(
      document.querySelectorAll('.q-field')
    ) as HTMLElement[]
    const field = fields.find(
      (f) =>
        f.getAttribute('aria-label') === n ||
        f.querySelector(`[aria-label="${n}"]`) !== null
    )
    const input = field?.querySelector('input')
    return {
      found: !!field,
      inputCount: field?.querySelectorAll('input').length ?? 0,
      inputReadonly: input?.hasAttribute('readonly') ?? null,
      inputValue: input?.value ?? null,
      options: Array.from(document.querySelectorAll('[role="option"]')).map(
        (o) => o.textContent?.trim()
      )
    }
  }, label)
  console.log(`[dump] ${label}:`, JSON.stringify(state))
  return state
}

test.describe('Invoice creation — company/client select search', () => {
  test('company select lists every company on open', async () => {
    await openCreateDialog()
    await openSelect('Company*')
    // Seeded by seed:test: "Acme Inc" and "Acme Retail BV".
    const options = page.getByRole('option')
    await expect(options.first()).toBeVisible({ timeout: 5_000 })
    await dumpSelectState('Company*')
    await expect(options).toHaveCount(2, { timeout: 5_000 })
    await expect(options.filter({ hasText: 'Acme Inc' })).toHaveCount(1)
    await expect(options.filter({ hasText: 'Acme Retail BV' })).toHaveCount(1)
  })

  test('company select accepts typed search input', async () => {
    await openCreateDialog()
    await openSelect('Company*')
    await expect(page.getByRole('option').first()).toBeVisible({
      timeout: 5_000
    })

    const input = await expectTypable('Company*')
    await input.pressSequentially('retail', { delay: 50 })
    await expect(input).toHaveValue('retail')
    await dumpSelectState('Company*')

    // input-debounce is 500ms in FilteredModelSelect.
    await expect(
      page.getByRole('option').filter({ hasText: 'Acme Retail BV' })
    ).toHaveCount(1, { timeout: 5_000 })
    await expect(
      page.getByRole('option').filter({ hasText: 'Acme Inc' })
    ).toHaveCount(0, { timeout: 5_000 })
  })

  test('client select accepts typed search input', async () => {
    await openCreateDialog()
    await openSelect('Client*')
    await expect(page.getByRole('option').first()).toBeVisible({
      timeout: 5_000
    })

    const input = await expectTypable('Client*')
    await input.pressSequentially('goods', { delay: 50 })
    await expect(input).toHaveValue('goods')
    await dumpSelectState('Client*')

    await expect(
      page.getByRole('option').filter({ hasText: 'Goods For All' })
    ).toHaveCount(1, { timeout: 5_000 })
  })

  test('create an invoice by searching company and client', async () => {
    await openCreateDialog()

    // Company: search, then pick the match.
    await openSelect('Company*')
    const companyInput = await expectTypable('Company*')
    await companyInput.pressSequentially('retail', { delay: 50 })
    await page
      .getByRole('option')
      .filter({ hasText: 'Acme Retail BV' })
      .click({ timeout: 5_000 })
    await page
      .locator('[role="listbox"]')
      .first()
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .catch(() => {})

    // Client: search, then pick the match.
    await openSelect('Client*')
    const clientInput = await expectTypable('Client*')
    await clientInput.pressSequentially('goods', { delay: 50 })
    await page
      .getByRole('option')
      .filter({ hasText: 'Goods For All' })
      .click({ timeout: 5_000 })
    await page
      .locator('[role="listbox"]')
      .first()
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .catch(() => {})

    // Number prefix: first available option (depends on the picked company).
    await openSelect('Number prefix*')
    await expect(page.getByRole('option').first()).toBeVisible({
      timeout: 5_000
    })
    await page.getByRole('option').first().click()
    await page
      .locator('[role="listbox"]')
      .first()
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .catch(() => {})

    await clickLinesAdd(page)
    await page.getByRole('textbox', { name: 'Description' }).fill('Search flow')
    const unitPrice = page
      .getByRole('spinbutton', { name: 'Unit price' })
      .first()
    await unitPrice.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      setter?.call(el, '75.00')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Submit' }).click()
    // The euro text also renders inside the still-open dialog line row -
    // require the dialog to close, otherwise a failed submit is false green.
    await expect(page.locator('.q-dialog:visible')).toHaveCount(0, {
      timeout: 10_000
    })
    await expect(page.getByText('€75.00').first()).toBeVisible({
      timeout: 10_000
    })
  })

  test('create dialog lists every company after an edit left a stale search phrase', async () => {
    // The edit path sets companiesSearchPhrase to the invoice's company name
    // (InvoicesPage onUpdate). Before the onFilter fix the select's open-event
    // never reached the parent, so the stale phrase survived into the next
    // dialog and the company select showed only the one match.
    await page.goto('/admin/invoices')
    await page.waitForLoadState('networkidle')
    await page.locator('.q-expansion-item__toggle-icon').first().click()
    await page
      .locator('.q-expansion-item__content')
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })

    await moreBtn(page)
    const editBtn = page.getByText('Update').first()
    await expect(editBtn).toBeVisible({ timeout: 3_000 })
    await editBtn.click()

    // Edit dialog open — this is what poisons companiesSearchPhrase.
    const editDialog = page.locator('.q-dialog').first()
    await editDialog.waitFor({ state: 'visible', timeout: 10_000 })
    await editDialog.locator('button i[class*="mdi-close"]').first().click()
    await expect(editDialog).not.toBeVisible({ timeout: 5_000 })

    // Fresh create dialog WITHOUT a page reload — page.goto() would reset
    // companiesSearchPhrase and mask the bug. Staying in the session is what
    // the user does.
    await page.locator('#fabAdd').click()
    await page
      .locator('.q-dialog')
      .waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(1_800)
    await openSelect('Company*')
    const options = page.getByRole('option')
    await expect(options).toHaveCount(2, { timeout: 7_000 })
    await expect(options.filter({ hasText: 'Acme Inc' })).toHaveCount(1)
    await expect(options.filter({ hasText: 'Acme Retail BV' })).toHaveCount(1)
  })
})
