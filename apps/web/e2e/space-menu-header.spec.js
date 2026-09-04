/**
 * Visual verification for the context menu's Space state header:
 * - compact group header cover (stronger gradient, hover reveals + grows header)
 * - ducked header is the Back control
 * - space icon box + name + member/invite pills
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

test('space menu header shows icon box, pills, X close, and hover-reveal cover', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  test.setTimeout(120000)
  fs.mkdirSync(screenshotDir, { recursive: true })

  // Open space menu state via ?space= — clicking a More Spaces card navigates to the
  // space home view (spaceEntryUrl), which does not mount .SpaceMenuHeader the same way.
  await page.goto('/groups/e2e-public-group/more-spaces?space=e2e-test-space')
  await waitPastRootSessionLoading(page)

  const spaceHeader = page.locator('.SpaceMenuHeader')
  await spaceHeader.waitFor({ state: 'visible', timeout: 60000 })

  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-menu-0-more-spaces.png')
  })

  await expect(page.getByTestId('group-header').getByLabel('Back')).toBeVisible()
  await expect(spaceHeader.getByRole('link', { name: /member/i })).toBeVisible()

  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-menu-1-space-state.png')
  })
  console.log('Screenshot saved: space-menu-1-space-state.png')

  const groupHeader = page.locator('[data-testid="group-header"]')
  const before = await groupHeader.boundingBox()
  await groupHeader.hover()
  await page.waitForTimeout(500)
  const after = await groupHeader.boundingBox()
  console.log(`group header height: ${before.height} -> ${after.height}`)
  expect(after.height).toBeGreaterThan(before.height)

  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-menu-2-header-hover.png')
  })
  console.log('Screenshot saved: space-menu-2-header-hover.png')

  await groupHeader.click()
  await spaceHeader.waitFor({ state: 'hidden' })
  await page.waitForTimeout(400)
  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-menu-3-closed.png')
  })
  console.log('Screenshot saved: space-menu-3-closed.png')
})
