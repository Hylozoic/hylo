import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Issue #975 — saving the Edit Profile form shows a "Your changes have been saved" toast.
 */

test.describe.configure({ timeout: 120000 })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

test('saving profile edits shows a confirmation toast', async ({ page }, testInfo) => {
  await page.goto('/my/edit-profile')
  await waitPastRootSessionLoading(page)

  const tagline = page.locator('#taglineField')
  await expect(tagline).toBeVisible({ timeout: 60000 })
  await tagline.fill(`E2E tagline ${Date.now()}`)

  // Desktop shows "Save Changes" in the sticky footer; mobile/tablet shows "Save" in the header
  const saveButton = page.getByRole('button', { name: /^Save( Changes)?$/ }).filter({ visible: true }).first()
  await expect(saveButton).toBeEnabled()
  await saveButton.click()

  const toast = page.getByText('Your changes have been saved')
  await expect(toast).toBeVisible({ timeout: 30000 })
  // Let the toast's slide-in animation finish so the screenshot shows it fully
  await page.waitForTimeout(600)

  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({ path: path.resolve(screenshotDir, `issue-975-${testInfo.project.name}.png`) })
})
