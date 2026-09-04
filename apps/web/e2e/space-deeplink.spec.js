/**
 * Cold deep link straight to a space URL must resolve, not hang on Loading.
 * Repro for the bug where SpaceContent's `!linkedSpace` gate waited forever:
 * nothing on a fresh page load fetched the parent group's spaces list. The
 * two-column ContextMenu happens to fetch it, so the hang shows on one-column
 * groups, where no ContextMenu mounts on space routes.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

test.describe.configure({ timeout: 120000 })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

test('deep link to a space in a two-column group resolves', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/groups/e2e-public-group/spaces/e2e-test-space')
  await waitPastRootSessionLoading(page)

  // Off-menu space: SpaceContent fetches spaces, then either shows the space
  // menu at the index or redirects to the home view. Either means the Loading
  // gate cleared — do not require a child path (the default 30s test timeout
  // was also shorter than that fetch + redirect).
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 60000 })
  await expect(page.getByTestId('loading-container')).toHaveCount(0, { timeout: 30000 })
  await expect(page).toHaveURL(/\/groups\/e2e-public-group\/spaces\/e2e-test-space(\/.*)?$/, { timeout: 30000 })
  await expect(page.getByText('E2E Test Space').first()).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('link', { name: /Signup or Login/i })).toHaveCount(0)

  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-deeplink-two-column.png')
  })
})

test('deep link to a space in a one-column group resolves', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/groups/e2e-one-column-group/spaces/e2e-one-column-space')
  await waitPastRootSessionLoading(page)

  await expect(page.getByTestId('loading-container').locator('.h-screen')).toHaveCount(0, { timeout: 30000 })
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 60000 })
  await expect(page).toHaveURL(/\/groups\/e2e-one-column-group\/spaces\/e2e-one-column-space/, { timeout: 30000 })

  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-deeplink-one-column-resolved.png')
  })
})
