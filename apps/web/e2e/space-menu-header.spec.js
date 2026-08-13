/**
 * Visual verification for the context menu's Space state header:
 * - compact group header cover (stronger gradient, hover reveals + grows header)
 * - X close button replacing the Back button
 * - space icon box + name + member/invite pills
 */
import { test, expect } from '@playwright/test'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

// The shared auth.setup user only exists in the isolated e2e DB; against the
// plain dev stack sign in directly with the .env dev credentials instead.
test.use({ storageState: { cookies: [], origins: [] } })

test('space menu header shows icon box, pills, X close, and hover-reveal cover', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/login')
  await page.getByLabel('email').fill(process.env.E2E_TEST_USERNAME)
  await page.getByLabel('password', { exact: true }).fill(process.env.E2E_TEST_PASSWORD)
  await page.getByRole('button', { name: /sign\s*in/i }).click()
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 60000 })

  await page.goto('/groups/building-hylo/more-views')
  await page.waitForLoadState('networkidle')

  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-menu-0-more-views.png')
  })

  // Find a space card in any of the space sections (Tracks / Funding Rounds / Other Spaces)
  let card = null
  for (const heading of ['Other Spaces', 'Tracks', 'Funding Rounds']) {
    const candidate = page.locator(`section:has-text("${heading}") [role="button"]`).first()
    if (await candidate.count() > 0) {
      card = candidate
      console.log(`Opening first space in section: ${heading}`)
      break
    }
  }
  expect(card, 'no space sections found on the More Views page for this group').not.toBeNull()

  await card.click()
  const spaceHeader = page.locator('.SpaceMenuHeader')
  await spaceHeader.waitFor({ state: 'visible' })
  await page.waitForLoadState('networkidle')
  // Let the duck/takeover transitions settle
  await page.waitForTimeout(500)

  // The new header pieces are present
  await expect(spaceHeader.getByLabel('Close')).toBeVisible()
  await expect(spaceHeader.locator('a[aria-label*="Members"]')).toBeVisible()

  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-menu-1-space-state.png')
  })
  console.log('Screenshot saved: space-menu-1-space-state.png')

  // Hover the ducked group header: cover fades out, header grows ~8px
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

  // Clicking the ducked header closes the space (back to the group menu)
  await groupHeader.click()
  await spaceHeader.waitFor({ state: 'hidden' })
  await page.waitForTimeout(400)
  await page.screenshot({
    path: path.resolve(screenshotDir, 'space-menu-3-closed.png')
  })
  console.log('Screenshot saved: space-menu-3-closed.png')
})
