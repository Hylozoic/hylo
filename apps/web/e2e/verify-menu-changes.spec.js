/**
 * Visual verification for menu chrome:
 * - member-count pill after the (i) on space rows in the group context menu
 * - post-view cards themed by post type (More Spaces + one-column grid)
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

test('group menu shows member pills on space rows and updated icons', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  test.setTimeout(240000)
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/groups/e2e-public-group')
  await waitPastRootSessionLoading(page)
  await page.locator('text=Loading views').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})

  await page.locator('.ContextMenu').screenshot({
    path: path.resolve(screenshotDir, 'menu-1-group-context-menu.png')
  })

  await page.goto('/groups/e2e-public-group/more-spaces')
  await waitPastRootSessionLoading(page)
  await expect(page.getByRole('button', { name: /E2E Test Space/ }).first()).toBeVisible({ timeout: 60000 })

  await page.screenshot({
    path: path.resolve(screenshotDir, 'menu-2-more-spaces.png'),
    fullPage: true
  })

  await page.goto('/groups/e2e-one-column-group')
  await waitPastRootSessionLoading(page)
  await page.locator('text=Loading views').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})
  await expect(page.locator('.ContextMenuGrid [role="button"]').first()).toBeVisible({ timeout: 30000 })
  await page.screenshot({
    path: path.resolve(screenshotDir, 'menu-3-one-column-grid.png'),
    fullPage: true
  })
})
