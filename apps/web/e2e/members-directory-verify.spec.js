import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

test('members page: counts, hidden empty roles, stable map, padding', async ({ page }) => {
  test.skip(test.info().project.name.includes('mobile'), 'members directory chrome is desktop')
  test.setTimeout(120000)
  const errors = []
  page.on('pageerror', err => errors.push(String(err)))

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/groups/e2e-public-group/members')
  await waitPastRootSessionLoading(page)

  const row = page.locator('div').filter({ has: page.getByRole('button', { name: /All members/ }) }).last()
  const coordinator = row.getByRole('button', { name: /Coordinator/ })
  await expect(coordinator).toBeVisible({ timeout: 30000 })
  await expect(coordinator).toContainText(/\d/)

  await expect(page.getByRole('button', { name: /Moderator/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^👋 Host/ })).toHaveCount(0)

  const pad = await page.evaluate(() => parseFloat(window.getComputedStyle(document.getElementById('members-page')).paddingBottom))
  console.log('padding-bottom:', pad)
  expect(pad).toBeGreaterThanOrEqual(100)

  await page.getByTestId('skill-map-toggle').click()
  const graph = page.getByTestId('member-skills-graph')
  await expect(graph).toBeVisible({ timeout: 60000 })
  await expect(graph.locator('canvas')).toBeVisible({ timeout: 30000 })

  await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="member-skills-graph"] canvas')
    if (canvas) canvas.dataset.stable = 'yes'
  })
  await coordinator.click()
  await page.waitForTimeout(1500)
  const marker = await page.evaluate(() =>
    document.querySelector('[data-testid="member-skills-graph"] canvas')?.dataset.stable)
  console.log('canvas marker after role change:', marker)
  expect(marker).toBe('yes')

  const loops = errors.filter(e => e.includes('Maximum update depth'))
  expect(loops).toHaveLength(0)

  await page.screenshot({ path: 'e2e/screenshots/members-verify.png', fullPage: false })
})
