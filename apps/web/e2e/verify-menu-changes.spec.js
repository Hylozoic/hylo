/**
 * Visual verification for menu changes (dev-stack only):
 * - member-count pill after the (i) on space rows in the group context menu
 * - new lucide icons: chat, proposals, related-groups, moderation
 * - post-view cards themed by post type / event date stack (More Views + one-column grid)
 */
import { test, expect } from '@playwright/test'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

// The shared auth.setup user only exists in the isolated e2e DB; against the
// plain dev stack sign in directly with the .env dev credentials instead.
test.use({ storageState: { cookies: [], origins: [] } })

test('group menu shows member pills on space rows and updated icons', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  test.setTimeout(240000)
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/login')
  await page.getByLabel('email').fill(process.env.E2E_TEST_USERNAME)
  await page.getByLabel('password', { exact: true }).fill(process.env.E2E_TEST_PASSWORD)
  await page.getByRole('button', { name: /sign\s*in/i }).click()
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 60000 })

  const setGroupNavStyle = async (ariaLabel) => {
    await page.goto('/my/appearance')
    const button = page.getByRole('button', { name: ariaLabel })
    await button.waitFor({ state: 'visible', timeout: 60000 })
    await button.click()
    // let the updateMe mutation persist
    await page.waitForTimeout(1500)
  }

  // Earlier runs may have left the shared user on Card Menu — reset first
  await setGroupNavStyle('Group Default')

  await page.goto('/groups/building-hylo')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  await page.locator('.ContextMenu').screenshot({
    path: path.resolve(screenshotDir, 'menu-1-group-context-menu.png')
  })

  await page.goto('/groups/building-hylo/more-spaces')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  await page.screenshot({
    path: path.resolve(screenshotDir, 'menu-2-more-spaces.png'),
    fullPage: true
  })

  // One-column dashboard grid: force Card Menu, screenshot, then restore.
  try {
    await setGroupNavStyle('Card Menu')
    await page.goto('/groups/building-hylo')
    await page.waitForLoadState('networkidle')
    await page.locator('text=Loading views').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: path.resolve(screenshotDir, 'menu-3-one-column-grid.png'),
      fullPage: true
    })
  } finally {
    await setGroupNavStyle('Group Default')
  }
})
