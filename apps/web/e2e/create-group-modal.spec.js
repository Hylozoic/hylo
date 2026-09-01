import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { openGlobalNavDrawerIfNeeded } from './helpers/sessionAuth.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

// Group seeded by scripts/seed-e2e-baseline.js — its name derives to its own slug,
// which is what makes it useful for exercising the taken-handle path.
const SEEDED_GROUP_NAME = 'E2E Join Public Restricted'
const SEEDED_GROUP_SLUG = 'e2e-join-public-restricted'

/**
 * Opens the create-group dialog via the `createGroup` query string.
 * @param {import('@playwright/test').Page} page
 * @param {string} url
 */
async function openCreateGroup (page, url) {
  await page.goto(url)
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 60000 })
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 30000 })
  return dialog
}

test.describe.configure({ timeout: 120000 })

test.describe('Create Group modal', () => {
  test.beforeAll(() => {
    fs.mkdirSync(screenshotDir, { recursive: true })
  })

  test('opens from the global nav and generates a handle from the name', async ({ page }) => {
    await page.goto('/public/all')
    await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 60000 })
    await openGlobalNavDrawerIfNeeded(page)
    await page.getByTestId('global-nav-create').click()
    await page.getByText('Create a group', { exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/createGroup=true/)
    await page.screenshot({ path: path.resolve(screenshotDir, 'create-group-01-modal-empty.png') })

    await dialog.locator('#groupName').fill('Bay & Delta  Watershed!')
    await expect(dialog.locator('#groupSlug')).toHaveValue('bay-delta-watershed')
    await expect(dialog.getByRole('button', { name: /Create Group/i })).toBeEnabled()
    await page.screenshot({ path: path.resolve(screenshotDir, 'create-group-02-handle-generated.png') })
  })

  test('reveals advanced settings inline', async ({ page }) => {
    const dialog = await openCreateGroup(page, `/public/all?createGroup=true&name=${encodeURIComponent('Watershed Council')}`)

    await dialog.getByRole('button', { name: 'Agreements', exact: true }).click()
    await dialog.getByRole('button', { name: 'Join questions', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Add an agreement' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Add a question' })).toBeVisible()
    await page.screenshot({ path: path.resolve(screenshotDir, 'create-group-03-advanced-open.png') })
  })

  test('flags a handle that is already taken', async ({ page }) => {
    const dialog = await openCreateGroup(page, '/public/all?createGroup=true')

    await dialog.locator('#groupName').fill(SEEDED_GROUP_NAME)
    await expect(dialog.locator('#groupSlug')).toHaveValue(SEEDED_GROUP_SLUG)
    await expect(dialog.getByText('This URL already exists. Try another.')).toBeVisible({ timeout: 30000 })
    await expect(dialog.getByRole('button', { name: /Create Group/i })).toBeDisabled()
    await page.screenshot({ path: path.resolve(screenshotDir, 'create-group-04-handle-taken.png') })
  })

  test('closing the modal returns to the page underneath', async ({ page }) => {
    const dialog = await openCreateGroup(page, '/public/all?createGroup=true')

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page).toHaveURL(/\/public\/all$/)
  })

  test('still renders as a standalone page', async ({ page }) => {
    await page.goto('/create-group')
    await expect(page.locator('#groupName')).toBeVisible({ timeout: 60000 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.screenshot({ path: path.resolve(screenshotDir, 'create-group-05-page-route.png'), fullPage: true })
  })
})
