import { test, expect } from '@playwright/test'
import { login } from './setup'
import {
  mkInvoice,
  ADMIN_EMAIL as email,
  ADMIN_PASSWORD as password
} from './helpers'

/**
 * Regression: the public invoice page must actually render the Typst invoice.
 *
 * `renderTypstInvoice` (packages/tools/src/typst/index.ts) injects `lang.typ`
 * and `internal.typ` into `templates/invoice/default.typ` by exact string
 * replacement of two `#import` lines. When either line is reformatted the
 * replacement no-ops, the leftover relative `#import` cannot be resolved by the
 * browser's Typst WASM world, and the page renders nothing:
 * `SourceDiagnostic: failed to load file (access denied)`.
 *
 * The typst CLI test in packages/tools cannot catch this — it compiles the
 * template from disk, where `./internal.typ` does resolve. Only a browser run
 * proved that the page itself was dead.
 */
test.describe('public invoice page', () => {
  test('renders the Typst invoice for an open invoice', async ({ browser }) => {
    test.slow()
    // An OPEN invoice, created through the admin UI, so the test does not
    // depend on demo-world invoice state other specs mutate.
    const admin = await browser.newPage({ bypassCSP: true })
    await login({ page: admin, email, password })
    const uuid = await mkInvoice(admin)
    await admin.close()
    expect(uuid).toBeTruthy()

    const page = await browser.newPage({ bypassCSP: true })
    const consoleErrors: string[] = []
    const record = (text: string) => {
      consoleErrors.push(text)
      // Surface the page's own diagnosis in the Playwright report: the renderer
      // swallows the Typst SourceDiagnostic into a console.error.
      console.log(`[page] ${text}`)
    }
    page.on('console', (msg) => record(`${msg.type()}: ${msg.text()}`))
    page.on('pageerror', (err) => record(`pageerror: ${err}`))

    await page.goto(`/invoice/${uuid}`)

    // The Typst MUST load its compiler/renderer WASM from the CDN and compile
    // the document; the div only exists once rendering succeeded.
    const invoice = page.locator('.q-scrollarea svg').first()
    await expect(invoice).toBeVisible({ timeout: 45_000 })

    // Body content proves the template rendered real data, not an empty frame.
    await expect(invoice).toContainText('E2E')

    expect(
      consoleErrors.filter((e) => /typst|failed to load file/i.test(e))
    ).toEqual([])

    // The header actions (and the amount line beneath them) must sit in the
    // horizontal middle. They are centred by `justify-center` on a `.row` that
    // is a shrink-to-fit flex item inside `.q-toolbar`, so the row needs an
    // explicit width. unocss-preset-quasar dropped `.row { flex: 1 1 auto }`
    // (2e24c50, "row/column are layout only"), which silently left every such
    // row hugging the left edge.
    const actions = page.locator('.q-toolbar').first().locator('.row > *')
    const edges = await actions.evaluateAll((els) =>
      els
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0)
        .map((r) => ({ left: r.left, right: r.right }))
    )
    const groupLeft = Math.min(...edges.map((e) => e.left))
    const groupRight = Math.max(...edges.map((e) => e.right))
    const centre = (groupLeft + groupRight) / 2
    expect(
      Math.abs(centre - page.viewportSize()!.width / 2),
      `header actions centred (group ${Math.round(groupLeft)}..${Math.round(groupRight)})`
    ).toBeLessThan(15)

    // The bank-transfer QR renders at the 5cm box its markup asks for. (The EPC
    // payload needs a valid IBAN: `generateEpcQrCodeData` throws otherwise,
    // `qrSvg` turns null and the dialog shows no QR at all.)
    await page.getByRole('button', { name: /pay/i }).click()
    await page.getByText('Bank transfer', { exact: false }).first().click()
    const qr = page.locator('.q-dialog #qrcode svg').first()
    await expect(qr).toBeVisible({ timeout: 10_000 })
    // The dialog scales in, so poll for the settled width — a single
    // `boundingBox()` catches the box mid-animation (measured 57px of 189).
    await expect
      .poll(async () => (await qr.boundingBox())?.width ?? 0, {
        timeout: 10_000,
        message: 'dialog QR reaches its 5cm box'
      })
      .toBeGreaterThan(150)
    const qrBox = (await qr.boundingBox())!
    expect(
      Math.abs(qrBox.width - qrBox.height),
      'dialog QR is square'
    ).toBeLessThan(2)

    await page.close()
  })
})
