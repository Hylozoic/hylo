/**
 * Visual proof that the stream's create prompt + view controls ride together in
 * one sticky container, and stay put once the stream scrolls under them.
 *
 * Run: yarn screenshot --project=chromium  (via run-isolated-e2e)
 *   or yarn node node_modules/@playwright/test/cli.js test stream-sticky-header
 */
import { expect, test } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP_PATH = '/groups/e2e-public-group/all'

test('stream header stays pinned while the stream scrolls', async ({ page }) => {
  fs.mkdirSync(screenshotDir, { recursive: true })

  // Short viewport so the seed's handful of posts is guaranteed to overflow —
  // the compact header freed enough height that a full-size window may not scroll
  await page.setViewportSize({ width: 1280, height: 500 })

  await page.goto(GROUP_PATH)
  await page.waitForLoadState('networkidle')

  // Dismiss the cookie banner so it doesn't sit over the stream in the shots
  const cookieButton = page.getByRole('button', { name: /Reject Non-Essential/i })
  if (await cookieButton.isVisible().catch(() => false)) {
    await cookieButton.click()
  }

  const scroller = page.locator('#stream-outer-container')
  // The header row sits directly in the scroller, outside the width-capped column
  const controls = page.locator('#stream-outer-container > .sticky').first()
  await expect(controls).toBeVisible()

  const before = await controls.boundingBox()
  await page.screenshot({ path: path.resolve(screenshotDir, 'stream-header-top.png') })

  // Scroll to the bottom — well past the header's height, so a non-sticky bar would be gone
  await scroller.evaluate(el => el.scrollTo({ top: el.scrollHeight }))
  await page.waitForTimeout(400)

  const after = await controls.boundingBox()
  const scrollerBox = await scroller.boundingBox()
  await page.screenshot({ path: path.resolve(screenshotDir, 'stream-header-scrolled.png') })

  // Pinned to the top of the scroll area. Not "unmoved" — it legitimately rises by
  // whatever slack sits above it before latching, so assert where it ends up.
  await expect(controls).toBeInViewport()
  expect(after.y - scrollerBox.y).toBeLessThan(4)
  expect(await scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(200)

  console.log(`header y before=${before.y} after=${after.y} scroller top=${scrollerBox.y}`)
})
