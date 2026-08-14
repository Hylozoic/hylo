/**
 * Cold deep link straight to a space URL must resolve, not hang on Loading.
 * Repro for the bug where SpaceContent's `!linkedSpace` gate waited forever:
 * nothing on a fresh page load fetched the parent group's spaces list. The
 * two-column ContextMenu happens to fetch it, so the hang shows on one-column
 * groups, where no ContextMenu mounts on space routes.
 */
import { test, expect } from '@playwright/test'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

// Sign in directly with the .env dev credentials — the shared auth.setup user
// only exists in the isolated e2e DB, and this repro needs the plain dev stack.
test.use({ storageState: { cookies: [], origins: [] } })

async function login (page) {
  await page.goto('/login')
  await page.getByLabel('email').fill(process.env.E2E_TEST_USERNAME)
  await page.getByLabel('password', { exact: true }).fill(process.env.E2E_TEST_PASSWORD)
  await page.getByRole('button', { name: /sign\s*in/i }).click()
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 60000 })
}

test('deep link to a space in a two-column group resolves', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only check')
  fs.mkdirSync(screenshotDir, { recursive: true })
  await login(page)

  // Full page load straight to the space URL — fresh redux store, nothing has
  // fetched the parent group's spaces yet. This is the cold deep-link case.
  await page.goto('/groups/building-hylo/spaces/resource-sharing-network')

  // Once the space resolves, the index route redirects into its home view
  // (two-column layout), so the URL gains a view segment past the space slug.
  await expect(page).toHaveURL(/\/groups\/building-hylo\/spaces\/resource-sharing-network\/.+/, { timeout: 20000 })
  await expect(page.getByTestId('loading-container')).toHaveCount(0, { timeout: 20000 })

  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-deeplink-two-column.png')
  })
})

test('deep link to a space in a one-column group resolves', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only check')
  fs.mkdirSync(screenshotDir, { recursive: true })
  await login(page)

  // One-column groups mount no ContextMenu on space routes, so nothing else
  // fetches the parent's spaces list — SpaceContent must fetch it itself.
  await page.goto('/groups/hylo-alliance/spaces/superspace')

  // Capture the state after a generous resolve window (pre-fix: stuck spinner)
  await page.waitForTimeout(12000)
  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-deeplink-one-column-after-12s.png')
  })

  // Resolution renders either the space's menu grid or its home view —
  // in both cases every Loading spinner is gone.
  await expect(page.getByTestId('loading-container')).toHaveCount(0, { timeout: 20000 })
  await expect(page.locator('#center-column-container')).toBeVisible()

  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-deeplink-one-column-resolved.png')
  })
})
