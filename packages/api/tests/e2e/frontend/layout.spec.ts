/**
 * The navigation rail must never cut a label *silently*.
 *
 * Seam: the browser — the label's own box (`scrollWidth` vs `clientWidth`) and
 * its computed `text-overflow`. No screenshots: a picture can show that a glyph is
 * missing, but only the box can say whether it was indicated.
 *
 * `q-tab__label` gets no `text-overflow` rule from the preset (it sets only
 * font-size/line-height/weight), so the computed value is the CSS **initial**
 * `clip`, while Quasar supplies `white-space: nowrap` + `overflow: hidden`. In the
 * 80dp rail the `Administrator` label is ~75px against ~78px of text, so the last
 * glyph was cut: the capture reads "Administrato". Measured by the audit at
 * 1440x900 — rail 80px, items 71px at x=4, label box x=4…79.
 *
 * Checked in all three locales, per the plan's edge case: assert against the
 * longest label the language files actually contain, not against today's English.
 * `administrator` happens to be 'Administrator' in all three, so the German guard
 * is the Account tab reading 'Konto' — proof the session really switched.
 */
import { expect, test } from '@playwright/test'
import { ADMIN, loginAs, newPage, setLocale } from './audit-helpers'

// Visible only: `MainLayout` renders `NavigationTabs` twice — line 63's drawer
// rail and line 291's `col-12 lt-md` mobile bar, which is display:none at 1440
// but still in the DOM.
const RAIL_LABELS = '.navigation-rail .q-tab__label:visible'

/** What the box does with text wider than it: clip, or say so with an ellipsis. */
const labelBox = (
  page: Awaited<ReturnType<typeof newPage>>['page'],
  index: number
) =>
  page
    .locator(RAIL_LABELS)
    .nth(index)
    .evaluate((el) => ({
      text: (el.textContent || '').trim(),
      overflow: el.scrollWidth - el.clientWidth,
      textOverflow: getComputedStyle(el).textOverflow
    }))

const expectNoSilentClip = (
  label: { text: string; overflow: number; textOverflow: string },
  where: string
) => {
  if (label.overflow > 0) {
    expect(
      label.textOverflow,
      `"${label.text}" is wider than its box in ${where} — it must ellipsize, not clip`
    ).toBe('ellipsis')
  }
}

test('every rail label fits or ellipsizes, in every locale', async ({
  browser
}) => {
  test.setTimeout(300_000)

  // The menu labels are the language's own name, in the session's language: the
  // English session offers 'English' / 'Dutch' / 'German'.
  const sessions: [string, string][] = [
    ['English', 'Account'],
    ['Dutch', 'Account'],
    ['German', 'Konto'] // the guard: proves the locale switch really applied
  ]

  for (const [menuLabel, expectedAccount] of sessions) {
    const { context, page } = await newPage(browser, {
      width: 1440,
      height: 900
    })
    await loginAs({ page, account: ADMIN })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await setLocale(page, menuLabel)
    // The German guard (`Konto`) proves the locale switch applied; wait for the
    // label rather than sleeping a fixed 1500ms.
    await expect(page.locator(RAIL_LABELS).nth(1)).toHaveText(expectedAccount, {
      timeout: 10_000
    })

    const labels = page.locator(RAIL_LABELS)
    await expect(labels).toHaveCount(3)

    // The third tab is the longest name the language files contain.
    const admin = await labelBox(page, 2)
    expect(admin.text, `rail content in ${menuLabel}`).toBe('Administrator')
    // Locale guard: the Account tab's title differs in German.
    expect((await labelBox(page, 1)).text).toBe(expectedAccount)

    for (let i = 0; i < 3; i++) {
      const box = await labelBox(page, i)
      expectNoSilentClip(box, `${menuLabel} tab ${i + 1}`)
    }

    await context.close()
  }
})
