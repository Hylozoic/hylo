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
 * The create-group modal. Scoped by accessible name so the closed GlobalNav
 * "Create" popover (also role=dialog while it animates out) is not matched.
 * @param {import('@playwright/test').Page} page
 */
function createGroupDialog (page) {
  return page.getByRole('dialog', { name: 'Create a group' })
}

/**
 * Opens the create-group dialog via the `createGroup` query string.
 * @param {import('@playwright/test').Page} page
 * @param {string} url
 */
async function openCreateGroup (page, url) {
  await page.goto(url)
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 60000 })
  const dialog = createGroupDialog(page)
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

    const dialog = createGroupDialog(page)
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
    await expect(createGroupDialog(page)).toBeHidden()
    await expect(page).toHaveURL(/\/public\/all$/)
  })

  test('warns before discarding entered group data', async ({ page }) => {
    const dialog = await openCreateGroup(page, '/public/all?createGroup=true')
    await dialog.locator('#groupName').fill('Watershed Council')

    await dialog.getByRole('button', { name: 'Cancel' }).click()

    const confirm = page.getByRole('dialog', { name: 'Discard this group?' })
    await expect(confirm).toBeVisible()
    await expect(confirm.getByRole('button', { name: 'Continue Editing' })).toBeVisible()
    await expect(confirm.getByRole('button', { name: 'Discard Group' })).toBeVisible()
    await expect(confirm.getByRole('button', { name: 'Save as Draft' })).toHaveCount(0)
    await page.screenshot({ path: path.resolve(screenshotDir, 'create-group-06-discard-confirm.png') })

    await confirm.getByRole('button', { name: 'Continue Editing' }).click()
    await expect(confirm).toBeHidden()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('#groupName')).toHaveValue('Watershed Council')

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await confirm.getByRole('button', { name: 'Discard Group' }).click()
    await expect(createGroupDialog(page)).toBeHidden()
    await expect(page).toHaveURL(/\/public\/all$/)
  })

  test('adding Welcome from the menu toggles the Welcome pill on, and removing it toggles it off', async ({ page }) => {
    const dialog = await openCreateGroup(page, '/public/all?createGroup=true')

    const welcomePill = dialog.getByRole('button', { name: 'Welcome', exact: true })
    await expect(welcomePill).toHaveAttribute('aria-pressed', 'false')

    await dialog.getByRole('button', { name: 'Edit Full Menu' }).click()
    await dialog.getByRole('button', { name: 'Add View' }).click()

    const addViewDialog = page.getByRole('dialog', { name: 'Add View' })
    await addViewDialog.getByRole('button', { name: /Welcome/ }).click()
    await addViewDialog.getByRole('button', { name: 'Next' }).click()

    const welcomePage = page.locator('h2', { hasText: 'Welcome Page' }).locator('..')
    await welcomePage.getByRole('button', { name: 'Add View' }).click()

    await expect(welcomePill).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.locator('[data-advanced-key="welcome"]')).toBeVisible()
    const menuPanel = dialog.locator('[data-advanced-key="views"]')
    await expect(menuPanel.getByText('Welcome', { exact: true })).toBeVisible()

    await welcomePill.click()
    await expect(welcomePill).toHaveAttribute('aria-pressed', 'false')
    await expect(menuPanel.getByText('Welcome', { exact: true })).toHaveCount(0)

    await welcomePill.click()
    await expect(welcomePill).toHaveAttribute('aria-pressed', 'true')
    await expect(menuPanel.getByText('Welcome', { exact: true })).toBeVisible()

    await menuPanel.locator('li').filter({ hasText: /^Welcome/ }).getByRole('button', { name: 'Remove view' }).click()
    await expect(welcomePill).toHaveAttribute('aria-pressed', 'false')
    await expect(dialog.locator('[data-advanced-key="welcome"]')).toHaveCount(0)
  })

  test('still renders as a standalone page', async ({ page }) => {
    await page.goto('/create-group')
    await expect(page.locator('#groupName')).toBeVisible({ timeout: 60000 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.screenshot({ path: path.resolve(screenshotDir, 'create-group-05-page-route.png'), fullPage: true })
  })
})
