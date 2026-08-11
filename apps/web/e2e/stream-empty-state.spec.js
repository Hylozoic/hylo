import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/session.json' })

test('empty stream shows centered cluster with create button', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.goto('/groups/building-hylo/stream')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(3000)
  await page.locator('[data-tooltip-content="Search posts"]').click()
  const searchInput = page.getByPlaceholder('Search posts')
  await searchInput.fill('zzzqqqxyzzy')
  await searchInput.press('Enter')
  await page.waitForTimeout(3000)

  const cluster = page.getByText('Nothing here yet', { exact: true })
  await expect(cluster).toBeVisible()
  const button = page.getByRole('button', { name: 'Create something' })
  await expect(button).toBeVisible()

  // Cluster should sit in the middle band of the stream area, not at the top
  const box = await cluster.boundingBox()
  console.log('cluster y:', box.y, 'url:', page.url())
  expect(box.y).toBeGreaterThan(300)
  expect(box.y).toBeLessThan(700)

  await page.screenshot({ path: 'e2e/screenshots/empty-state.png' })

  await button.click()
  await page.waitForTimeout(1500)
  const url = page.url()
  console.log('after click:', url)
  expect(url).toContain('/create/post')
  await page.screenshot({ path: 'e2e/screenshots/empty-state-create.png' })
})
