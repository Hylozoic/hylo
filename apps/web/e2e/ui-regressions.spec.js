import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.describe.configure({ timeout: 120000 })

test.use({ storageState: 'e2e/.auth/session.json' })

test('explorer titles are white in light mode', async ({ page }) => {
  await page.goto('/public/groups')
  await waitPastRootSessionLoading(page)
  const name = page.locator('span.font-bold', { hasText: 'E2E Public Group' }).first()
  await expect(name).toBeVisible({ timeout: 30000 })
  const color = await name.evaluate(el => window.getComputedStyle(el).color)
  console.log('title color:', color)
  expect(color).toBe('rgb(255, 255, 255)')
  await page.screenshot({ path: 'e2e/screenshots/explorer-titles.png' })
})

test('stream controls use border-2', async ({ page }) => {
  // data-testid=stream-view-controls is on the desktop view-mode group (max-sm:hidden);
  // phones replace it with a lens dropdown.
  test.skip(test.info().project.name.includes('mobile'), 'view-mode control group is desktop-only')
  await page.goto('/groups/e2e-public-group/all')
  await waitPastRootSessionLoading(page)
  const controls = page.getByTestId('stream-view-controls')
  await expect(controls).toBeVisible({ timeout: 30000 })
  const width = await controls.evaluate(el => window.getComputedStyle(el).borderTopWidth)
  console.log('control border width:', width)
  expect(width).toBe('2px')
})

test('directly loaded space closes to group home', async ({ page }) => {
  test.skip(test.info().project.name.includes('mobile'), 'space menu header is desktop chrome')
  await page.goto('/groups/e2e-public-group/more-spaces?space=e2e-test-space')
  await waitPastRootSessionLoading(page)
  await expect(page.locator('.SpaceMenuHeader')).toBeVisible({ timeout: 60000 })
  await page.screenshot({ path: 'e2e/screenshots/space-direct.png' })
  await page.getByTestId('group-header').click()
  await expect(page.locator('.SpaceMenuHeader')).toBeHidden({ timeout: 15000 })
  const url = page.url()
  console.log('after close:', url)
  expect(url.includes('space=')).toBe(false)
})
