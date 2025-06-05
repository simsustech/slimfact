import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { faker } from '@faker-js/faker'

const email = 'admin@slimfact.app'
const password = 'Sif5uEG5hcTH'

let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()

  await page.goto('/')

  await page.click('text=Login')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveURL(/.*login/)

  await page.locator('text="Email"').fill(email)
  await page.locator('text="Password"').fill(password)

  await page.locator('button >> text=Login').click()

  await page.waitForURL(/.*user/)
  await expect(
    page
      .getByRole('tab', { name: 'Administrator' })
      .or(page.getByText('Administrator').locator(':scope.q-item__label'))
  ).toBeVisible()
})

test.describe('Settings', async () => {
  test('Companies', async () => {
    await page.goto('/admin/settings/companies')

    await page.locator('#fabAdd').click()
    await page
      .getByRole('textbox', { name: 'Name*' })
      .fill(faker.company.name())
    await page
      .getByRole('textbox', { name: 'Contact person name' })
      .fill(faker.person.fullName())
    await page
      .getByRole('textbox', { name: 'Address*' })
      .fill(faker.location.streetAddress())
    await page
      .getByRole('textbox', { name: 'Postal code*' })
      .fill(faker.location.zipCode())
    await page
      .getByRole('textbox', { name: 'City*' })
      .fill(faker.location.city())
    await page
      .getByRole('textbox', { name: 'Country*' })
      .fill(faker.location.countryCode())
    await page
      .getByRole('textbox', { name: 'Telephone number*' })
      .fill(faker.phone.number())
    await page
      .getByRole('textbox', { name: 'Website' })
      .fill(faker.internet.domainName())
    await page
      .getByRole('textbox', { name: 'CoC number*' })
      .fill(faker.string.numeric(10))
    await page
      .getByRole('textbox', { name: 'IBAN*' })
      .fill(faker.finance.iban())
    await page.getByRole('textbox', { name: 'BIC*' }).fill(faker.finance.bic())
    await page
      .getByRole('textbox', { name: 'VAT ID number*' })
      .fill(faker.string.numeric(10))
    await page
      .getByRole('textbox', { name: 'Prefix*' })
      .fill(faker.string.alpha(8))
    await page
      .getByRole('textbox', { name: 'Email*' })
      .fill(faker.internet.email())
    await page
      .getByRole('textbox', { name: 'Email BCC' })
      .fill(faker.internet.email())

    await page.getByRole('button', { name: 'Submit' }).click()
  })
})

test.describe('Administrator', async () => {
  test('Clients', async () => {
    await page.goto('/admin/clients')

    await page.locator('#fabAdd').click()
    await page
      .getByRole('textbox', { name: 'Company name' })
      .fill(faker.company.name())
    await page
      .getByRole('textbox', { name: 'Name contact person' })
      .fill(faker.person.fullName())
    await page
      .getByRole('textbox', { name: 'Address*' })
      .fill(faker.location.streetAddress())
    await page
      .getByRole('textbox', { name: 'Postal code*' })
      .fill(faker.location.zipCode())
    await page
      .getByRole('textbox', { name: 'City*' })
      .fill(faker.location.city())
    await page
      .getByRole('textbox', { name: 'Country' })
      .fill(faker.location.countryCode())
    await page
      .getByRole('textbox', { name: 'VAT ID number' })
      .fill(faker.string.numeric(10))
    await page
      .getByRole('textbox', { name: 'CoC number' })
      .fill(faker.string.numeric(10))
    await page
      .getByRole('textbox', { name: 'Email*' })
      .fill(faker.internet.email())
    await page.getByRole('button', { name: 'Submit' }).click()
  })

  test('Bills', async () => {
    await page.goto('/admin/bills')

    await page.locator('#fabAdd').click()
    await page.getByRole('combobox', { name: 'Company*' }).click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    await page.getByRole('option').first().click()

    await page.getByRole('toolbar').first().click({ force: true })
    await expect(page.getByRole('listbox').first()).not.toBeVisible()

    await page.getByRole('combobox', { name: 'Client*' }).click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    await page.getByRole('option').first().click()

    await page.getByRole('toolbar').first().click({ force: true })
    await expect(page.getByRole('listbox').first()).not.toBeVisible()

    await page.getByRole('combobox', { name: 'Number prefix*' }).click()
    await expect(page.getByRole('option').first()).toBeVisible()

    await page.getByRole('option').first().click()

    await page
      .getByRole('list')
      .filter({ hasText: 'Lines Add' })
      .getByRole('listitem')
      .click()
    await page.getByRole('textbox', { name: 'Description' }).click()
    await page.getByRole('textbox', { name: 'Description' }).fill('test')
    await page.getByRole('spinbutton', { name: 'Unit price' }).fill('123.00')
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Submit' }).click()

    await expect(page.getByText('€123.00').first()).toBeVisible()
  })

  test('Invoices', async () => {
    await page.goto('/admin/invoices')

    await page.locator('#fabAdd').click()
    await page.getByRole('combobox', { name: 'Company*' }).click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    await page.getByRole('option').first().click()

    await page.getByRole('toolbar').first().click({ force: true })
    await expect(page.getByRole('listbox').first()).not.toBeVisible()

    await page.getByRole('combobox', { name: 'Client*' }).click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    await page.getByRole('option').first().click()

    await page.getByRole('toolbar').first().click({ force: true })
    await expect(page.getByRole('listbox').first()).not.toBeVisible()

    await page.getByRole('combobox', { name: 'Number prefix*' }).click()
    await expect(page.getByRole('option').first()).toBeVisible()

    await page.getByRole('option').first().click()

    await page
      .getByRole('list')
      .filter({ hasText: 'Lines Add' })
      .getByRole('listitem')
      .click()
    await page.getByRole('textbox', { name: 'Description' }).click()
    await page.getByRole('textbox', { name: 'Description' }).fill('test')
    await page.getByRole('spinbutton', { name: 'Unit price' }).fill('123.00')
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Submit' }).click()

    await expect(page.getByText('€123.00').first()).toBeVisible()
  })

  test('Subscriptions', async () => {
    await page.goto('/admin/subscriptions')

    await page.locator('#fabAdd').click()
    await page.getByRole('combobox', { name: 'Company*' }).click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    await page.getByRole('option').first().click()

    await page.getByRole('toolbar').first().click({ force: true })
    await expect(page.getByRole('listbox').first()).not.toBeVisible()

    await page.getByRole('combobox', { name: 'Client*' }).click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    await page.getByRole('option').first().click()

    await page.getByRole('toolbar').first().click({ force: true })
    await expect(page.getByRole('listbox').first()).not.toBeVisible()

    await page.getByRole('combobox', { name: 'Number prefix*' }).click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    await page.getByRole('option').first().click()

    await page.getByRole('toolbar').first().click({ force: true })
    await expect(page.getByRole('listbox').first()).not.toBeVisible()

    await page
      .getByRole('list')
      .filter({ hasText: 'Lines Add' })
      .getByRole('listitem')
      .click()
    await page.getByRole('textbox', { name: 'Description' }).click()
    await page.getByRole('textbox', { name: 'Description' }).fill('test')
    await page.getByRole('spinbutton', { name: 'Unit price' }).fill('123.00')
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Submit' }).click()
  })
})
