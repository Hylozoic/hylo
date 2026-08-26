/**
 * Visual verification for the space create/edit modal redesign:
 * - icon row stays on one line, shedding suggestions as the column narrows,
 *   with a "Search Icons" picker button
 * - Handle field matches the group creation UX (@ prefix, info button, URL preview)
 * - description/location share the standard input chrome
 * - Access renders as the group creation modal's SettingSelectRow dropdown
 */
import { test, expect } from '@playwright/test'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP = 'building-hylo'

test.use({ storageState: { cookies: [], origins: [] } })
test.setTimeout(240000)

function shot (name) {
  return path.resolve(screenshotDir, `space-redesign-${name}.png`)
}

test('space modals carry the group creation form treatment', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  const pageErrors = []
  page.on('pageerror', err => pageErrors.push(String(err)))

  await page.goto('/login')
  await expect(page.getByLabel('email')).toBeVisible({ timeout: 180000 })
  await page.getByLabel('email').fill(process.env.E2E_TEST_USERNAME)
  await page.getByLabel('password', { exact: true }).fill(process.env.E2E_TEST_PASSWORD)
  await page.getByRole('button', { name: /sign\s*in/i }).click()
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 120000 })

  await page.goto(`/groups/${GROUP}/more-spaces?edit=true`)
  await page.waitForLoadState('networkidle')

  // ---- Create modal ----
  const center = page.locator('#center-column-container')
  await center.getByRole('button', { name: 'Add', exact: true }).first().click()
  await page.getByText('Add Space', { exact: true }).click()
  const heading = page.locator('h2', { hasText: /Create a new space in/ })
  await expect(heading).toBeVisible({ timeout: 20000 })

  const searchIcons = page.getByRole('button', { name: 'Search Icons' })
  await expect(searchIcons).toBeVisible()
  await expect(page.getByText('Handle', { exact: true })).toBeVisible()
  await expect(page.locator('text=hylo.com/groups/building-hylo/spaces/')).toBeVisible()

  // Icon suggestions all sit on one line: same vertical position as the picker button
  const iconButtons = page.locator('button[aria-label="Circle"], button[aria-label="Globe"]')
  const firstBox = await page.locator('button[aria-label="Circle"]').boundingBox()
  const searchBox = await searchIcons.boundingBox()
  expect(Math.abs(firstBox.y - searchBox.y)).toBeLessThan(4)
  await page.screenshot({ path: shot('1-create-wide') })

  // Access dropdown opens with the group-modal option list
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByRole('button', { name: 'Role Gated' })).toBeVisible()
  await page.screenshot({ path: shot('2-create-access-open'), animations: 'disabled' })

  // Role Gated selection reveals the role picker under the row
  await page.getByRole('button', { name: 'Role Gated' }).click()
  await expect(page.getByPlaceholder('Search roles/badges')).toBeVisible()

  // Search Icons opens the searchable Lucide picker
  await searchIcons.click()
  await expect(page.getByPlaceholder('Search icons')).toBeVisible({ timeout: 5000 })
  await page.screenshot({ path: shot('3-create-icon-picker') })
  await page.keyboard.press('Escape')

  // ---- Narrow column: suggestions shed to keep one row ----
  const wideCount = await iconButtons.count()
  await page.setViewportSize({ width: 420, height: 900 })
  const narrowFirst = await page.locator('div:has(> button[aria-label="Circle"])').first().boundingBox()
    .catch(() => null)
  const narrowSearchBox = await searchIcons.boundingBox()
  const circleBox = await page.locator('button[aria-label="Circle"]').boundingBox()
  expect(Math.abs(circleBox.y - narrowSearchBox.y)).toBeLessThan(4)
  await page.screenshot({ path: shot('4-create-narrow'), fullPage: false })
  await page.setViewportSize({ width: 1280, height: 720 })

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(heading).toHaveCount(0)

  // ---- Settings modal for an existing space ----
  const settingsButton = center.locator('button[aria-label="Settings"]').first()
  await settingsButton.scrollIntoViewIfNeeded()
  await settingsButton.click()
  await expect(page.locator('h2', { hasText: /Space Settings/ })).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('button', { name: 'Search Icons' })).toBeVisible()
  await expect(page.getByText('Handle', { exact: true })).toBeVisible()
  await page.screenshot({ path: shot('5-settings') })

  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByRole('button', { name: 'Role Gated' })).toBeVisible()
  await page.screenshot({ path: shot('6-settings-access-open'), animations: 'disabled' })

  console.log('WIDE ICON COUNT SAMPLE:', wideCount, 'NARROW BOXES:', JSON.stringify({ narrowFirst }))
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toHaveLength(0)
})
