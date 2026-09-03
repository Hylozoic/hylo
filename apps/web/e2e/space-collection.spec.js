/**
 * Visual check for the Space Collection view (read + edit).
 * Seed: `E2E Space Collection` on `e2e-public-group` (`seed-e2e-baseline.js`).
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

test('space collection view screenshots in read and edit mode', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  await seedGroupMembershipLastViewed(page, GROUP_SLUG)

  await page.goto(`/groups/${GROUP_SLUG}/all`)
  await waitPastRootSessionLoading(page)
  await page.locator('text=Loading views').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})

  const collectionItem = page.getByText(COLLECTION_NAME).first()
  await expect(collectionItem).toBeVisible(uiTimeout)
  await collectionItem.click()
  await page.waitForURL(/space-collection\//, { timeout: 15000 })
  const collectionUrl = page.url().replace(/\?.*$/, '')

  await expect(page.getByTestId('space-collection')).toBeVisible(uiTimeout)
  await page.screenshot({ path: path.resolve(screenshotDir, 'space-collection-read.png') })

  await page.goto(`${collectionUrl}?edit=true`)
  await waitPastRootSessionLoading(page)
  await expect(page.getByTestId('space-collection')).toBeVisible(uiTimeout)
  await expect(page.getByText('Add spaces')).toBeVisible(uiTimeout)
  await page.screenshot({ path: path.resolve(screenshotDir, 'space-collection-edit.png') })
})
