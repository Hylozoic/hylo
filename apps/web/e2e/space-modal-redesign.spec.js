/**
 * Visual verification for the space create/edit modal redesign:
 * - icon row stays on one line, shedding suggestions as the column narrows,
 *   with a "Search Icons" picker button
 * - Handle field matches the group creation UX (@ prefix, info button, URL preview)
 * - description/location share the standard input chrome
 * - Access renders as the group creation modal's SettingSelectRow dropdown
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP = 'e2e-public-group'

test.use({ storageState: 'e2e/.auth/session.json' })
test.setTimeout(240000)

function shot (name) {
  return path.resolve(screenshotDir, `space-redesign-${name}.png`)
}

test('space modals carry the group creation form treatment', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  const pageErrors = []
  page.on('pageerror', err => pageErrors.push(String(err)))

  await page.goto(`/groups/${GROUP}/more-spaces?edit=true`)
  await waitPastRootSessionLoading(page)
  await page.waitForLoadState('networkidle')

  // ---- Create modal ----
  const center = page.locator('#center-column-container')
  await center.getByRole('button', { name: 'Add to More Spaces' }).click()
  const heading = page.locator('h2', { hasText: /Create a new space in/ })
  await expect(heading).toBeVisible({ timeout: 20000 })

  const searchIcons = page.getByRole('button', { name: 'Search Icons' })
  await expect(searchIcons).toBeVisible()
  await expect(page.getByText('Handle', { exact: true })).toBeVisible()
  await expect(page.locator('text=hylo.com/groups/e2e-public-group/spaces/')).toBeVisible()

  // Icon suggestions all sit on one line: same vertical position as the picker button
  const iconButtons = page.locator('button[aria-label="Circle"], button[aria-label="Globe"]')
  const firstBox = await page.locator('button[aria-label="Circle"]').boundingBox()
  const searchBox = await searchIcons.boundingBox()
  expect(Math.abs(firstBox.y - searchBox.y)).toBeLessThan(4)
  await page.screenshot({ path: shot('1-create-wide') })

  // Access dropdown opens with the group-modal option list, including Paid
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByRole('button', { name: 'Role Gated' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Paid' })).toBeVisible()
  await page.screenshot({ path: shot('2-create-access-open'), animations: 'disabled' })

  // Role Gated selection reveals the role picker under the row
  await page.getByRole('button', { name: 'Role Gated' }).click()
  await expect(page.getByPlaceholder('Search roles/badges')).toBeVisible()

  // Name and Handle share a row on desktop (labels align; the handle input itself
  // sits inside its @-prefixed wrapper, so compare the labels)
  const nameLabel = await page.getByText('Name', { exact: true }).boundingBox()
  const handleLabel = await page.getByText('Handle', { exact: true }).boundingBox()
  expect(Math.abs(nameLabel.y - handleLabel.y)).toBeLessThan(4)

  // Home picker with segments, and the additional-settings pills
  await expect(page.getByText("Choose your space's home")).toBeVisible()
  await expect(page.getByText('Activity Stream')).toBeVisible()
  for (const label of ['Location', 'Post types', 'Welcome']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: shot('7-create-home-additional'), animations: 'disabled' })

  // Welcome reveals its control surface with the page editor inside
  await page.getByRole('button', { name: 'Welcome', exact: true }).click()
  await expect(page.getByText('Show this welcome page to new members when they first land in the space.')).toBeVisible()
  await page.locator('[data-advanced-key="welcome"]').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: shot('8-create-welcome-open'), animations: 'disabled' })

  // Edit Full Menu swaps the picker for the menu editor, which now includes Welcome
  await page.getByRole('button', { name: 'Edit Full Menu' }).click()
  const menuPanel = page.locator('[data-advanced-key="views"]')
  await expect(menuPanel.getByText('All Activity')).toBeVisible()
  await expect(menuPanel.getByText('Welcome', { exact: true })).toBeVisible()
  await page.screenshot({ path: shot('9-create-menu-editor') })
  await page.getByRole('button', { name: 'Hide Menu Items' }).click()

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

  // Name and Handle stack on mobile widths
  const nameLabelNarrow = await page.getByText('Name', { exact: true }).boundingBox()
  const handleLabelNarrow = await page.getByText('Handle', { exact: true }).boundingBox()
  expect(handleLabelNarrow.y).toBeGreaterThan(nameLabelNarrow.y + 40)
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

test('adding Welcome from the menu toggles the Welcome pill on, and removing it toggles it off', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only interaction check')

  await page.goto(`/groups/${GROUP}/more-spaces?edit=true`)
  await waitPastRootSessionLoading(page)
  await page.waitForLoadState('networkidle')

  await page.locator('#center-column-container').getByRole('button', { name: 'Add to More Spaces' }).click()
  await expect(page.locator('h2', { hasText: /Create a new space in/ })).toBeVisible({ timeout: 20000 })

  const welcomePill = page.getByRole('button', { name: 'Welcome', exact: true })
  await expect(welcomePill).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: 'Edit Full Menu' }).click()
  await page.locator('[data-advanced-key="views"]').getByRole('button', { name: 'Add View' }).click()

  const addViewDialog = page.getByRole('dialog', { name: 'Add View' })
  await addViewDialog.getByRole('button', { name: /Welcome/ }).click()
  await addViewDialog.getByRole('button', { name: 'Next' }).click()

  const welcomePage = page.locator('h2', { hasText: 'Welcome Page' }).locator('..')
  await welcomePage.getByRole('button', { name: 'Add View' }).click()

  await expect(welcomePill).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-advanced-key="welcome"]')).toBeVisible()
  const menuPanel = page.locator('[data-advanced-key="views"]')
  await expect(menuPanel.getByText('Welcome', { exact: true })).toBeVisible()

  await welcomePill.click()
  await expect(welcomePill).toHaveAttribute('aria-pressed', 'false')
  await expect(menuPanel.getByText('Welcome', { exact: true })).toHaveCount(0)

  await welcomePill.click()
  await expect(welcomePill).toHaveAttribute('aria-pressed', 'true')
  await expect(menuPanel.getByText('Welcome', { exact: true })).toBeVisible()

  await menuPanel.locator('li').filter({ hasText: /^Welcome/ }).getByRole('button', { name: 'Remove view' }).click()
  await expect(welcomePill).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-advanced-key="welcome"]')).toHaveCount(0)
})
