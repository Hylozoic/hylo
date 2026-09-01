import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

test('empty stream shows centered cluster with create button', async ({ page }) => {
  test.skip(test.info().project.name.includes('mobile'), 'empty-state geometry is a desktop stream layout')
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.goto('/groups/e2e-public-group/all')
  await waitPastRootSessionLoading(page)
  await page.locator('[data-tooltip-content="Search posts"]').click()
  const searchInput = page.getByPlaceholder('Search posts')
  await searchInput.fill('zzzqqqxyzzy')
  await searchInput.press('Enter')
  await expect(page.getByText('Nothing here yet', { exact: true })).toBeVisible({ timeout: 30000 })

  const cluster = page.getByText('Nothing here yet', { exact: true })
  const button = page.getByRole('button', { name: 'Create something' })
  await expect(button).toBeVisible()

  // Cluster should sit in the middle band of the stream area, not at the top
  const box = await cluster.boundingBox()
  console.log('cluster y:', box.y, 'url:', page.url())
  expect(box.y).toBeGreaterThan(300)
  expect(box.y).toBeLessThan(700)

  await page.screenshot({ path: 'e2e/screenshots/empty-state.png' })

  await button.click()
  await expect(page).toHaveURL(/\/create\/post/, { timeout: 15000 })
  await page.screenshot({ path: 'e2e/screenshots/empty-state-create.png' })
})
