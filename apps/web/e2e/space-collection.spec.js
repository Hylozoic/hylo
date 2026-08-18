/**
 * Visual check for the Space Collection view (read + edit).
 * Creates a collection on the seeded public group if one does not already exist.
 *
 * Run: yarn test:e2e space-collection --project=chromium
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { seedGroupMembershipLastViewed } from './helpers/seedGroupMembershipLastViewed.js'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP_SLUG = 'e2e-public-group'
const COLLECTION_NAME = 'E2E Space Collection'
const uiTimeout = { timeout: 60000 }

test.describe.configure({ timeout: 120000 })

/** Cookie banner can sit over the menu; dismiss if it is present. */
async function dismissCookieBanner (page) {
  const save = page.getByRole('button', { name: /Save and Continue/i })
  if (await save.count()) await save.click()
}

test('space collection view screenshots in read and edit mode', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  await seedGroupMembershipLastViewed(page, GROUP_SLUG)
  await dismissCookieBanner(page)

  await page.goto(`/groups/${GROUP_SLUG}/all?edit=true`)
  await waitPastRootSessionLoading(page)
  await page.locator('text=Loading views').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})
  await dismissCookieBanner(page)

  if (!(await page.getByText('Add', { exact: true }).count())) {
    await page.getByText('Edit Menu').first().click()
    await page.waitForURL(/edit=true/, { timeout: 15000 })
  }

  let collectionUrl = null
  const existing = page.getByText(COLLECTION_NAME).first()
  if (await existing.count()) {
    await existing.click()
    await page.waitForURL(/space-collection\//, { timeout: 15000 })
    collectionUrl = page.url().replace(/\?.*$/, '')
  }

  if (!collectionUrl) {
    const addTrigger = page.getByText('Add', { exact: true }).last()
    await expect(addTrigger).toBeVisible(uiTimeout)
    await addTrigger.click()
    await page.getByRole('menuitem').filter({ hasText: 'Add View' }).click()
    await page.getByText('Space Collection', { exact: true }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Space Collection' })).toBeVisible(uiTimeout)
    await page.getByPlaceholder('Name').fill(COLLECTION_NAME)
    await page.getByRole('button', { name: 'Add View' }).click()
    await expect(page.getByRole('heading', { name: 'Add View' })).toHaveCount(0, uiTimeout)

    // Menu items are not navigable while the sidebar is in edit mode.
    const done = page.getByText('Done Editing').first()
    if (await done.count()) await done.click()

    const created = page.getByText(COLLECTION_NAME).first()
    await expect(created).toBeVisible(uiTimeout)
    await created.click()
    await page.waitForURL(/space-collection\//, { timeout: 15000 })
    collectionUrl = page.url().replace(/\?.*$/, '')
  }

  expect(collectionUrl, 'expected to land on a space-collection view').toBeTruthy()

  await page.goto(collectionUrl)
  await waitPastRootSessionLoading(page)
  await expect(page.getByTestId('space-collection')).toBeVisible(uiTimeout)
  await page.screenshot({ path: path.resolve(screenshotDir, 'space-collection-read.png') })

  await page.goto(`${collectionUrl}?edit=true`)
  await waitPastRootSessionLoading(page)
  await expect(page.getByTestId('space-collection')).toBeVisible(uiTimeout)
  await expect(page.getByText('Add spaces')).toBeVisible(uiTimeout)
  await page.screenshot({ path: path.resolve(screenshotDir, 'space-collection-edit.png') })
})
