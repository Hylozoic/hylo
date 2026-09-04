import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.describe.configure({ timeout: 120000 })

test.use({ storageState: 'e2e/.auth/session.json' })

test('long group names show fully with pills intact', async ({ page }) => {
  test.skip(test.info().project.name.includes('mobile'), 'header lives in the desktop context menu')
  await page.goto('/groups/e2e-public-group/all')
  await waitPastRootSessionLoading(page)
  await expect(page.locator('.GroupMenuHeaderName')).toBeVisible({ timeout: 60000 })

  const geom = await page.evaluate(() => {
    const h1 = document.querySelector('.GroupMenuHeaderName')
    const header = document.querySelector('.GroupMenuHeader')
    const pill = header?.querySelector('a[href*="/members"]')
    const style = window.getComputedStyle(h1)
    return {
      text: h1.textContent,
      clamp: style.webkitLineClamp,
      truncated: h1.scrollHeight > h1.clientHeight + 8,
      lines: Math.round(h1.clientHeight / parseFloat(style.lineHeight)),
      pillVisible: Boolean(pill && pill.getBoundingClientRect().height > 0),
      pillBottom: pill ? pill.getBoundingClientRect().bottom : null,
      headerBottom: header.getBoundingClientRect().bottom
    }
  })
  console.log(JSON.stringify(geom))
  expect(geom.clamp === 'none' || geom.clamp === '').toBe(true)
  expect(geom.truncated).toBe(false)
  expect(geom.pillVisible).toBe(true)
  expect(geom.pillBottom).toBeLessThanOrEqual(geom.headerBottom)
  await page.locator('.GroupMenuHeader').screenshot({ path: 'e2e/screenshots/header-name.png' })
})
