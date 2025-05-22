import { test, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import type { Locator, Page } from '@playwright/test'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const email = faker.internet.email()
const password = faker.internet.password()

let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  async function dragAndDrop(locatorToDrag: Locator) {
    const toDragBox = await locatorToDrag.boundingBox()

    await locatorToDrag.hover()
    await page.mouse.down()
    delay(200)
    await page.mouse.move(
      toDragBox!.x + 300,
      toDragBox!.y + toDragBox!.height / 2
    )
    await page.mouse.up()
  }

  page = await browser.newPage()

  await page.goto('/')

  await page.click('text=Login')

  await page.waitForLoadState('networkidle')
  await page.click('text=Create account')

  await delay(200)
  await page.locator('text="Email"').fill(email)
  await page.locator('text="Password"').fill(password)
  await page.locator('text="Repeat password"').fill(password)

  const slider = page.locator('.q-slider__thumb')

  await dragAndDrop(slider)

  await page.locator('button >> text=Submit').click()

  const dialog = page.locator(
    'text="Your account has been sucessfully created. You can now login with your credentials."'
  )
  const okButton = dialog.locator('../div/button')
  await okButton.click()

  await expect(page).toHaveURL(/.*login/)

  await page.locator('text="Email"').fill(email)
  await page.locator('text="Password"').fill(password)

  await page.locator('button >> text=Login').click()

  await page.waitForURL(/.*user/)
  await expect(
    page
      .getByRole('tab', { name: 'Account' })
      .or(page.getByText('Account').locator(':scope.q-item__label'))
  ).toBeVisible()
})
test.describe('Account', async () => {
  test('Home', async () => {
    await page.goto('/account')
  })
})
