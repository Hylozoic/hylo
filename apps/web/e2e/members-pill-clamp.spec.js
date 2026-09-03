import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

test('members page pill clamp does not loop', async ({ page }) => {
  test.skip(test.info().project.name.includes('mobile'), 'pill clamp is a desktop layout check')
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(String(err)))

  await page.goto('/groups/e2e-public-group/members')
  await waitPastRootSessionLoading(page)
  await expect(page.getByRole('button', { name: /All members/ })).toBeVisible({ timeout: 30000 })

  const widths = [1400, 1000, 800, 700, 600, 900, 1200, 1400]
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(600)
  }

  const loops = errors.filter(e => e.includes('Maximum update depth'))
  console.log(`TOTAL console errors: ${errors.length}, update-depth errors: ${loops.length}`)
  for (const e of errors.slice(0, 10)) console.log('ERR:', e.slice(0, 500))
  expect(loops).toHaveLength(0)
})
