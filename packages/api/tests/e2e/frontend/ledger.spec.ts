/**
 * A ledger row's invoice link must actually select that invoice.
 *
 * Seam: the browser — click the link the user clicks, then count what the
 * invoice list renders.
 *
 * The route is `/admin/invoices/:uuids*`, which takes path params. The ledger
 * links with `/admin/invoices?uuid=…`, so the query param selects nothing and the
 * list falls back to its default page: the user lands on five unrelated invoices
 * instead of the one they clicked.
 *
 * The behavioural assertion comes first and the `href` check second: the click
 * is what the user experiences, and it fails as a UI symptom (5 rows, not 1)
 * rather than as a string mismatch.
 */
import { expect, test } from '@playwright/test'
import { ADMIN, loginAs, newPage, setLocale } from './audit-helpers'

test('a ledger row opens exactly the invoice it names', async ({ browser }) => {
  test.setTimeout(180_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: ADMIN })

  await page.goto('/admin/payments')
  await page.waitForLoadState('networkidle')

  const links = page.locator('[data-testid=ledger-invoice-link]')
  await expect(links.first()).toBeVisible({ timeout: 30_000 })
  const count = await links.count()
  expect(count).toBeGreaterThan(0)

  // Rows whose payment carries no `invoiceUuid` render no link at all (v-if), so
  // every link that exists must point at its own invoice.
  const hrefs = await links.evaluateAll((els) =>
    els.map((el) => el.getAttribute('href'))
  )
  expect(hrefs).toHaveLength(count)

  const link = links.first()
  const invoiceNumber = (await link.innerText()).trim()
  await link.click()
  await page.waitForLoadState('networkidle')

  // Behaviour: the user sees the invoice they clicked — one row, not a list.
  const rows = page.locator('.q-expansion-item')
  await expect(rows).toHaveCount(1, { timeout: 30_000 })
  await expect(rows.first()).toContainText(invoiceNumber)

  // Mechanism, as a guard so a future refactor cannot reintroduce the query form.
  for (const href of hrefs) expect(href).not.toContain('?uuid=')

  await context.close()
})

/**
 * The ledger must show translated labels, not the stored enum values.
 *
 * `methodLabel` indexes the label map with the value as stored, but the map's
 * keys are camelCase (`bankTransfer`) while the data carries the enum's own
 * spelling (`banktransfer`, `ideal`), so the lookup misses and the raw value is
 * printed. The status column reads `props.row.status` directly.
 */
test('the ledger renders translated method and status labels', async ({
  browser
}) => {
  test.setTimeout(180_000)
  const { context, page } = await newPage(browser, { width: 1440, height: 900 })
  await loginAs({ page, account: ADMIN })

  await page.goto('/admin/payments')
  await page.waitForLoadState('networkidle')

  const chips = page.locator('.q-chip')
  await expect(chips.first()).toBeVisible({ timeout: 30_000 })
  const chipTexts = (await chips.allInnerTexts()).map((t) => t.trim())
  // Labels for the methods the seeded ledger actually carries.
  expect(chipTexts).toContain('Bank transfer')
  expect(chipTexts).toContain('Credit card')
  expect(chipTexts).toContain('iDEAL')
  // …and no chip shows a stored enum value.
  for (const raw of RAW_METHODS) expect(chipTexts).not.toContain(raw)

  // Dutch session, switched through the UI and then re-mounted so the labels
  // built during setup are built in Dutch as well.
  await setLocale(page, 'Dutch')
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('thead')).toContainText('Methode')

  const cells = page.locator('tbody td')
  await expect(cells.first()).toBeVisible({ timeout: 30_000 })
  const texts = (await cells.allInnerTexts()).map((t) => t.trim())
  expect(texts).toContain('Betaald')
  for (const raw of RAW_STATUSES) expect(texts).not.toContain(raw)

  await context.close()
})

/** Stored enum values that must never reach the screen. */
const RAW_METHODS = [
  'banktransfer',
  'ideal',
  'creditcard',
  'directdebit',
  'wero'
]
const RAW_STATUSES = ['paid', 'pending', 'failed', 'authorized', 'expired']
