/**
 * Shared helpers for the frontend visual/a11y audit.
 *
 * The audit answers questions the app's own specs cannot: what does every route
 * *look* like and *announce*, in both schemes, at both viewports. It reads the
 * accessibility tree shape, computed styles, emitted design tokens and
 * hit-testing — never app internals (the single exception is `$q.screen`, which
 * is the value the preset owns).
 *
 * Pre-flight for any spec in this directory — the linked worktrees must be part
 * of the image build, or the audit measures published packages instead of the
 * code under test:
 *
 *   cd ~/Projects/slimfact
 *   export SIMSUSTECH_NPM_TOKEN=$(cat ./env/SIMSUSTECH_NPM_TOKEN)
 *   export LINKED_QUASAR_COMPONENTS_PATH=$HOME/Projects/quasar-components/packages/components
 *   export LINKED_UNOCSS_PRESET_QUASAR_PATH=$HOME/Projects/unocss-preset-quasar/.worktrees/rules/packages/preset
 *   export TEST_CADDY_HTTP_PORT=8080 TEST_CADDY_HTTPS_PORT=8443
 *
 * The last line matters because `global-setup.ts` runs `up -d --wait` with no
 * service list, so this stack's own caddy tries to bind 80/443 — which the
 * petboarding dev stack already owns on the shared `web` network.
 *
 * Captures live under Playwright's output dir. Never pass `--output=` to a
 * Playwright command while this directory holds captures: Playwright wipes its
 * output dir at the start of every run.
 */
import { type Browser, type BrowserContext, type Page } from '@playwright/test'
import { login } from '../setup'

export const BASE =
  process.env.PLAYWRIGHT_BASE_URL || 'https://slimfact.localhost'
export const ADMIN = { email: 'admin@slimfact.app', password: 'Sif5uEG5hcTH' }
/** Seeded by `packages/api/src/kysely/seeds/test.ts`. */
export const CUSTOMER = {
  email: 'customer@slimfact.app',
  password: 'Sif5uEG5hcTH'
}

export const AUDIT_DIR = 'test-results/frontend-audit'

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 }
] as const

const OPEN_INVOICE = '00000000-0000-4000-8000-000000000003'
const PAID_INVOICE = '00000000-0000-4000-8000-000000000002'
const OPEN_BILL = '00000000-0000-4000-8000-000000000015'
const OPEN_RECEIPT = '00000000-0000-4000-8000-000000000020'

/** Public — reachable without a session. */
export const PUBLIC_ROUTES: [string, string][] = [
  ['/', 'home'],
  [`/invoice/${OPEN_INVOICE}`, 'invoice-public-open'],
  [`/invoice/${OPEN_BILL}`, 'invoice-public-bill'],
  ['/_audit-not-a-route', 'error404']
]

/** Administrator routes, in routes.ts order. */
export const ADMIN_ROUTES: [string, string][] = [
  ['/user', 'user'],
  ['/admin', 'admin-home'],
  ['/admin/dashboard', 'admin-dashboard'],
  ['/admin/clients', 'admin-clients'],
  ['/admin/invoices', 'admin-invoices'],
  [`/admin/invoices/${OPEN_INVOICE}`, 'admin-invoices-selected'],
  [
    `/admin/invoices/${OPEN_INVOICE}/${PAID_INVOICE}`,
    'admin-invoices-multi-selected'
  ],
  ['/admin/subscriptions', 'admin-subscriptions'],
  ['/admin/receipts', 'admin-receipts'],
  [`/admin/receipts/${OPEN_RECEIPT}`, 'admin-receipts-selected'],
  ['/admin/bills', 'admin-bills'],
  [`/admin/bills/${OPEN_BILL}`, 'admin-bills-selected'],
  ['/admin/payments', 'admin-payments'],
  ['/admin/bank', 'admin-bank-redirect'],
  ['/admin/settings', 'admin-settings'],
  ['/admin/settings/companies', 'admin-settings-companies'],
  ['/admin/settings/accounts', 'admin-settings-accounts'],
  ['/admin/settings/numberprefixes', 'admin-settings-numberprefixes'],
  ['/admin/settings/initialnumberforprefixes', 'admin-settings-initialnumbers'],
  ['/admin/settings/exports', 'admin-settings-exports'],
  ['/admin/settings/banking', 'admin-settings-banking'],
  ['/checkout', 'checkout'],
  ['/checkout/success', 'checkout-success'],
  ['/account', 'admin-account-empty'],
  ['/account/invoices', 'admin-account-invoices-empty']
]

/** The client-linked account — needs the seeded `customer@slimfact.app`. */
export const CUSTOMER_ROUTES: [string, string][] = [
  ['/', 'customer-home'],
  ['/user', 'customer-user'],
  ['/account', 'account-home'],
  ['/account/invoices', 'account-invoices'],
  [`/account/invoices/${OPEN_INVOICE}`, 'account-invoices-selected'],
  ['/account/bills', 'account-bills'],
  ['/account/receipts', 'account-receipts']
]

/** Every route the audit sweeps: 4 + 25 + 7 = 36. */
export const ALL_ROUTE_GROUPS = [
  { key: 'public', routes: PUBLIC_ROUTES, session: null },
  { key: 'admin', routes: ADMIN_ROUTES, session: ADMIN },
  { key: 'customer', routes: CUSTOMER_ROUTES, session: CUSTOMER }
] as const

export const routeCount = () =>
  PUBLIC_ROUTES.length + ADMIN_ROUTES.length + CUSTOMER_ROUTES.length

export async function newPage(
  browser: Browser,
  viewport: { width: number; height: number },
  opts: { locale?: string } = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block'
  })
  if (opts.locale) {
    // The app reads its locale from $q.localStorage (MainLayout.vue onMounted);
    // Quasar's LocalStorage JSON-stringifies, hence the quotes.
    await context.addInitScript((v) => {
      try {
        window.localStorage.setItem('locale', JSON.stringify(v))
      } catch {
        /* storage can be unavailable in a fresh context */
      }
    }, opts.locale)
  }
  const page = await context.newPage()
  return { context, page }
}

/** Delegates to the suite's own login so the flow stays in one place. */
export async function loginAs({
  page,
  account
}: {
  page: Page
  account: { email: string; password: string }
}) {
  await login({ page, email: account.email, password: account.password })
}

/**
 * Log in, or report that the account is missing instead of failing the sweep.
 *
 * The customer account only exists once it is seeded, so the capture spec runs
 * its customer legs conditionally — the run logs the skip rather than reporting
 * a green sweep that silently covered 29 routes.
 */
export async function tryLoginAs({
  page,
  account
}: {
  page: Page
  account: { email: string; password: string }
}): Promise<boolean> {
  try {
    await loginAs({ page, account })
    return true
  } catch (e) {
    console.log(
      `[audit] login as ${account.email} failed — skipping its routes (${String(e).slice(0, 120)})`
    )
    return false
  }
}

/**
 * Dark mode lives inside the header's overflow menu, but the audit drives it
 * through $q directly — one call instead of four menu interactions per route.
 */
export async function setDark(page: Page) {
  // The client app hydrates asynchronously: right after goto() `#app` exists
  // but has no __vue_app__ yet, so $q is unreachable and a bare evaluate
  // silently no-ops.
  await page.waitForFunction(
    () =>
      !!(document.querySelector('#app') as any)?.__vue_app__?.config
        ?.globalProperties?.$q,
    null,
    { timeout: 15000 }
  )
  await page.evaluate(() => {
    const $q = (document.querySelector('#app') as any).__vue_app__.config
      .globalProperties.$q
    $q.dark.set(true)
  })
  await page.waitForFunction(
    () => document.body.className.includes('body--dark'),
    null,
    { timeout: 5000 }
  )
  await delay(250)
}

/** Language select lives inside the header's overflow menu ("English"). */
export async function setLocale(page: Page, label: string) {
  await page.locator('header button').last().click()
  await delay(500)
  const menu = page.locator('.q-menu').last()
  await menu.locator('.q-select').first().click()
  await delay(500)
  await page
    .locator('.q-menu:visible .q-item')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .last()
    .click()
  await delay(1500)
  await page.keyboard.press('Escape')
  await delay(500)
}

/**
 * How long a route needs before its content is trustworthy. The public invoice
 * page mounts Typst's WASM compiler before it can paint the preview — the first
 * paint is still a bare spinner at 7 s.
 */
export const settleMs = (slug: string) =>
  /invoice-public/.test(slug)
    ? 20000
    : /dashboard|payments|banking/.test(slug)
      ? 5000
      : 2200

/**
 * The survey. Runs in the page and is deliberately implementation-agnostic: it
 * reads the accessibility tree shape, computed styles, hit-testing and the
 * emitted tokens. It must stay self-contained — Playwright serializes it.
 */
export const SURVEY = () => {
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return false
    if (Number(cs.opacity) === 0) return false
    return true
  }
  const describe = (el: Element) => {
    const id = el.id ? `#${el.id}` : ''
    const cls = String((el as HTMLElement).className || '')
      .split(/\s+/)
      .filter((c) => c && !c.startsWith('q-'))
      .slice(0, 2)
      .join('.')
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return `${el.tagName.toLowerCase()}${id}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`
  }
  const accName = (el: Element) => {
    const al = el.getAttribute?.('aria-label')
    if (al && al.trim()) return al.trim()
    const lb = el.getAttribute?.('aria-labelledby')
    if (lb) {
      const t = lb
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim()
      if (t) return t
    }
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (l?.textContent?.trim()) return l.textContent.trim()
    }
    const closest = el.closest('label')
    if (closest?.textContent?.trim()) return closest.textContent.trim()
    const t = (el.textContent || '').trim()
    if (t) return t
    const title = el.getAttribute?.('title')
    if (title?.trim()) return title.trim()
    const img = el.querySelector?.('img[alt]')
    if (img?.getAttribute('alt')?.trim()) return img.getAttribute('alt')!.trim()
    const input = (
      el.matches?.('input,textarea,select')
        ? el
        : el.querySelector?.('input,textarea,select')
    ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
    if (input) {
      if (input.id) {
        const l = document.querySelector(`label[for="${CSS.escape(input.id)}"]`)
        if (l?.textContent?.trim()) return l.textContent.trim()
      }
      const al2 = input.getAttribute('aria-label')
      const ph = input.getAttribute('placeholder')
      if (al2?.trim()) return al2.trim()
      if (ph?.trim()) return `(placeholder only: ${ph.trim()})`
      return '(no name)'
    }
    if (el.tagName === 'IMG')
      return el.getAttribute('alt')?.trim() ? 'img-alt' : '(img no alt)'
    return '(no name)'
  }

  /* ---- contrast ---- */
  const parseColor = (c: string) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1]
      .split(/[,\s/]+/)
      .filter(Boolean)
      .map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
    const f = (v: number) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const over = (fg: any, bg: any) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  })
  const effBg = (el: Element) => {
    let node: Element | null = el
    let acc: any = null
    while (node && node !== document.documentElement) {
      const c = parseColor(getComputedStyle(node).backgroundColor)
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c
        if (c.a === 1) return acc
      }
      node = node.parentElement
    }
    return acc || { r: 255, g: 255, b: 255, a: 1 }
  }
  const ratio = (a: any, b: any) => {
    const l1 = lum(a)
    const l2 = lum(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  const contrast = { failures: [] as any[], checked: 0 }
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (!visible(el)) continue
    if (
      ![...el.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent || '').trim()
      )
    )
      continue
    const cs = getComputedStyle(el)
    const fg = parseColor(cs.color)
    if (!fg) continue
    const bg = effBg(el)
    const painted = fg.a < 1 ? over(fg, bg) : fg
    const size = parseFloat(cs.fontSize)
    const weight = Number(cs.fontWeight) || 400
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const need = large ? 3 : 4.5
    const r = ratio(painted, bg)
    contrast.checked++
    if (r < need) {
      contrast.failures.push({
        sel: describe(el),
        ratio: Math.round(r * 100) / 100,
        need,
        fg: `rgb(${painted.r | 0},${painted.g | 0},${painted.b | 0})`,
        bg: `rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0})`,
        size: `${size}px/${weight}`
      })
    }
  }

  /* ---- interactive controls ---- */
  const controls = Array.from(
    document.querySelectorAll(
      'a[href], button, input, select, textarea, [role=button], [role=tab], [tabindex]:not([tabindex="-1"])'
    )
  ).filter(visible)
  const unnamed = controls.filter((el) => {
    if (el.matches('input[type=hidden]')) return false
    const n = accName(el)
    return n === '(no name)' || n === '(img no alt)'
  })
  const small = controls.filter((el) => {
    const r = el.getBoundingClientRect()
    return r.width < 44 || r.height < 44
  })

  /* ---- hit testing (blocked controls) ---- */
  const blocked: any[] = []
  for (const el of controls) {
    const r = el.getBoundingClientRect()
    if (r.bottom < 0 || r.top > innerHeight) continue
    const x = r.left + Math.min(r.width / 2, 12)
    const y = r.top + r.height / 2
    if (x < 0 || x > innerWidth) continue
    const hit = document.elementFromPoint(x, y)
    if (!hit) continue
    if (hit === el || el.contains(hit) || hit.contains(el)) continue
    blocked.push({
      sel: describe(el),
      by: describe(hit),
      box: [r.width | 0, r.height | 0, r.x | 0, r.y | 0]
    })
  }

  /* ---- structure ---- */
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .filter(visible)
    .map(
      (h) =>
        `${h.tagName}: ${(h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)}`
    )
  const imgsNoAlt = Array.from(document.querySelectorAll('img')).filter(
    (i) => visible(i) && !i.hasAttribute('alt')
  ).length
  const images = Array.from(document.querySelectorAll('img'))
    .filter(visible)
    .map((i) => ({
      src: (i.getAttribute('src') || '').slice(0, 60),
      alt: i.getAttribute('alt')
    }))
  const ids: Record<string, boolean> = {}
  const dupIds: string[] = []
  for (const el of Array.from(document.querySelectorAll('[id]'))) {
    if (ids[el.id]) dupIds.push(el.id)
    ids[el.id] = true
  }

  /* ---- tokens / md3 samples ---- */
  const cs0 = getComputedStyle(document.documentElement)
  const tok = document.body ? getComputedStyle(document.body) : cs0
  const q = (document.querySelector('#app') as any)?.__vue_app__?.config
    ?.globalProperties?.$q
  const btn = document.querySelector('.q-btn')
  const field = document.querySelector('.q-field__control')
  const header = document.querySelector('.q-header')
  const drawer = document.querySelector('.q-drawer')
  const tokens: Record<string, string> = {}
  for (const n of [
    '--q-primary',
    '--q-on-primary',
    '--q-secondary-container',
    '--q-on-secondary-container',
    '--q-positive',
    '--q-negative',
    '--q-surface',
    '--q-on-surface',
    '--q-surface-variant',
    '--q-outline',
    '--q-comp-sm',
    '--q-comp-md',
    '--q-size-sm',
    '--q-size-md',
    '--q-headline-small',
    '--q-title-large',
    '--q-title-medium',
    '--q-label-large'
  ])
    // The preset declares the component/type scales on `body`, not `:root`.
    tokens[n] = (tok.getPropertyValue(n) || cs0.getPropertyValue(n)).trim()
  const styleOf = (el: Element | null, props: string[]) =>
    el
      ? Object.fromEntries(
          props.map((p) => [p, getComputedStyle(el)[p as any]])
        )
      : null

  return {
    url: location.href,
    title: document.title,
    body: {
      dark: document.body.className.includes('body--dark'),
      className: document.body.className.slice(0, 120)
    },
    screen: q
      ? {
          name: q.screen.name,
          width: q.screen.width,
          gtSm: q.screen.gt.sm,
          ltSm: q.screen.lt.sm,
          sizes: q.screen.sizes
        }
      : null,
    counts: {
      controls: controls.length,
      unnamed: unnamed.length,
      small: small.length,
      blocked: blocked.length,
      contrastChecked: contrast.checked,
      contrastFailures: contrast.failures.length,
      h1: headings.filter((h) => h.startsWith('h1')).length,
      imgsNoAlt
    },
    unnamed: unnamed.slice(0, 20).map(describe),
    small: small.slice(0, 20).map((el) => {
      const r = el.getBoundingClientRect()
      return `${describe(el)} ${r.width | 0}x${r.height | 0}`
    }),
    blocked: blocked.slice(0, 20),
    headings,
    images: images.slice(0, 12),
    dupIds: [...new Set(dupIds)].slice(0, 10),
    contrast: contrast.failures.slice(0, 25),
    tokens,
    styles: {
      btn: styleOf(btn, [
        'height',
        'borderRadius',
        'backgroundColor',
        'color',
        'minHeight',
        'fontSize'
      ]),
      field: styleOf(field, ['height', 'minHeight']),
      header: styleOf(header, ['height', 'backgroundColor', 'zIndex']),
      drawer: styleOf(drawer, ['width', 'backgroundColor']),
      body: styleOf(document.body, [
        'backgroundColor',
        'color',
        'fontFamily',
        'fontSize'
      ])
    },
    overflow: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      innerWidth
    },
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200)
  }
}
