import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/session.json' })

test('members page: counts, hidden empty roles, stable map, padding', async ({ page }) => {
  const errors = []
  page.on('pageerror', err => errors.push(String(err)))

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/groups/building-hylo/members')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)

  // Role pill counts fetched and rendered
  const row = page.locator('div').filter({ has: page.getByRole('button', { name: /All members/ }) }).last()
  const coordinator = row.getByRole('button', { name: /Coordinator/ })
  await expect(coordinator).toContainText('7')

  // Zero-member roles hidden
  await expect(page.getByRole('button', { name: /Moderator/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^👋 Host/ })).toHaveCount(0)

  // Bottom padding >= 100px
  const pad = await page.evaluate(() => parseFloat(window.getComputedStyle(document.getElementById('members-page')).paddingBottom))
  console.log('padding-bottom:', pad)
  expect(pad).toBeGreaterThanOrEqual(100)

  // Mark the map canvas, change role filter, canvas must survive (no rebuild)
  await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="member-skills-graph"] canvas')
    if (canvas) canvas.dataset.stable = 'yes'
  })
  await coordinator.click()
  await page.waitForTimeout(2500)
  const marker = await page.evaluate(() =>
    document.querySelector('[data-testid="member-skills-graph"] canvas')?.dataset.stable)
  console.log('canvas marker after role change:', marker)
  expect(marker).toBe('yes')

  const loops = errors.filter(e => e.includes('Maximum update depth'))
  expect(loops).toHaveLength(0)

  await page.screenshot({ path: 'e2e/screenshots/members-verify.png', fullPage: false })
})
