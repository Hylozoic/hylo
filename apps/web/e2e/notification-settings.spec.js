import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Post-notification labels after D8/D88/D94: "No Posts (mentions still notify)" and the
 * adaptive "Important Posts (Announcements, Mentions & Replies)", in the per-group settings
 * and in a space's About page. Screenshots go to e2e/screenshots.
 * Requires the E2E seed (e2e.user belongs to e2e-public-group).
 */

test.use({ storageState: 'e2e/.auth/session.json' })
test.describe.configure({ timeout: 180000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

const NO_POSTS = 'No Posts (mentions still notify)'
const IMPORTANT = 'Important Posts (Announcements, Mentions & Replies)'
const RECEIVE_POSTS = 'Receive new post notifications for'

async function capture (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({ path: path.resolve(screenshotDir, `notification-settings-${name}.png`), animations: 'disabled' })
}

async function openPostSettingOptions (page) {
  const row = page.locator('div', { has: page.getByText(RECEIVE_POSTS, { exact: true }) }).last()
  await row.getByRole('combobox').click()
  await expect(page.getByRole('option', { name: NO_POSTS })).toBeVisible(uiTimeout)
  await expect(page.getByRole('option', { name: IMPORTANT })).toBeVisible(uiTimeout)
}

test('per-group settings list the relabelled post options', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only screenshot')

  await page.goto('/my/notifications')
  await waitPastRootSessionLoading(page)
  await expect(page).toHaveURL(/\/my\/notifications/, navTimeout)

  // Open the first group's settings
  await page.locator('[id^="group-"] h2').first().click()
  await expect(page.getByText(RECEIVE_POSTS, { exact: true }).first()).toBeVisible(uiTimeout)
  await capture(page, 'group-row')

  await openPostSettingOptions(page)
  await capture(page, 'group-options')
  await page.keyboard.press('Escape')
})

test("a space's About page lists the relabelled post options", async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only screenshot')

  await page.goto('/groups/e2e-public-group/spaces/e2e-test-space/about')
  await waitPastRootSessionLoading(page)
  await expect(page.locator('#center-column')).toBeVisible(uiTimeout)

  const settingsLabel = page.getByText(RECEIVE_POSTS, { exact: true }).first()
  const isMember = await settingsLabel.isVisible({ timeout: 30000 }).catch(() => false)
  test.skip(!isMember, 'the E2E user is not a member of the seeded space')

  await capture(page, 'space-about')
  await openPostSettingOptions(page)
  await capture(page, 'space-options')
  await page.keyboard.press('Escape')
})
