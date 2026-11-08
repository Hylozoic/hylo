import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Issue #1239 — the emoji box on a new role/badge must explain itself, and
 * trying to create one without an emoji must say which part is missing.
 * The draft role is never saved, so no seeded data changes.
 */

test.describe.configure({ timeout: 120000 })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

test('new role/badge explains the emoji box and names the missing emoji', async ({ page }, testInfo) => {
  await page.goto('/groups/e2e-public-group/settings/roles')
  await waitPastRootSessionLoading(page)

  await page.getByText('Create new role/badge').click({ timeout: 60000 })

  // Common roles have the box too; the new draft role is the last one
  const emojiTrigger = page.getByTestId('role-emoji-trigger').last()
  await expect(emojiTrigger).toBeVisible()
  await expect(emojiTrigger).toHaveAccessibleName('Choose an emoji for this role/badge')
  await expect(page.getByText('Click the box to choose an emoji for this role/badge')).toBeVisible()

  await page.locator('input[value=""]').filter({ visible: true }).last().fill('Gardener')

  let alertMessage = null
  page.once('dialog', async (dialog) => {
    alertMessage = dialog.message()
    await dialog.dismiss()
  })
  await page.getByText('Create Role', { exact: true }).click()
  await expect.poll(() => alertMessage).not.toBeNull()
  expect(alertMessage).toBe('Please choose an emoji for this role/badge by clicking the box next to its name')

  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.getByText('Click the box to choose an emoji for this role/badge').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.resolve(screenshotDir, `issue-1239-after-${testInfo.project.name}.png`) })

  // Opening the box shows the picker
  await emojiTrigger.click()
  await expect(page.locator('em-emoji-picker')).toBeVisible({ timeout: 30000 })
})
