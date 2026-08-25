/**
 * Visual verification for the Add Space modal title, which now names where the
 * space will land: "the main menu" when opened from the group menu, or
 * "More Spaces" when opened off-menu (addToMenu={false}).
 *
 * Both routes render an Add control, so each case scopes its click: the More
 * Spaces page owns the one inside #center-column-container, while the group
 * menu's lives in the sidebar outside it.
 */
import { test, expect } from '@playwright/test'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP = 'building-hylo'

test.use({ storageState: { cookies: [], origins: [] } })

// Vite's cold dep-prebundle can hold the app on its loading splash well past the 30s default.
test.setTimeout(240000)

async function openAddSpaceDialog (page, root) {
  await root.getByRole('button', { name: 'Add', exact: true }).first().click()
  await page.getByText('Add Space', { exact: true }).click()
  const heading = page.locator('h2', { hasText: /Create a new space in/ })
  await expect(heading).toBeVisible({ timeout: 20000 })
  return heading
}

test('Add Space modal title names its destination', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/login')
  await expect(page.getByLabel('email')).toBeVisible({ timeout: 180000 })
  await page.getByLabel('email').fill(process.env.E2E_TEST_USERNAME)
  await page.getByLabel('password', { exact: true }).fill(process.env.E2E_TEST_PASSWORD)
  await page.getByRole('button', { name: /sign\s*in/i }).click()
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 120000 })

  // Off-menu: the More Spaces page's own Add, inside the center column
  await page.goto(`/groups/${GROUP}/more-spaces?edit=true`)
  await page.waitForLoadState('networkidle')
  let heading = await openAddSpaceDialog(page, page.locator('#center-column-container'))
  console.log('MORE SPACES title:', JSON.stringify(await heading.textContent()))
  await expect(heading).toHaveText(/More Spaces/)
  await page.screenshot({ path: path.resolve(screenshotDir, 'add-space-title-more-spaces.png') })

  // On-menu: the sidebar's group-menu Add (ContextMenu's default addToMenu).
  // Reload first — the dialog has no Escape handler, so a fresh page clears it.
  await page.goto(`/groups/${GROUP}/more-spaces?edit=true`)
  await page.waitForLoadState('networkidle')
  heading = await openAddSpaceDialog(page, page)
  console.log('MAIN MENU title:', JSON.stringify(await heading.textContent()))
  await expect(heading).toHaveText(/the main menu/)
  await page.screenshot({ path: path.resolve(screenshotDir, 'add-space-title-main-menu.png') })
})
