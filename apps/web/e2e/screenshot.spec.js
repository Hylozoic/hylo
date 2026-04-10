/**
 * Screenshot utility for visual verification.
 *
 * Usage:
 *   E2E_PATH=/groups/my-group npx playwright test screenshot
 *   E2E_PATH=/groups/my-group E2E_SCREENSHOT_NAME=my-feature npx playwright test screenshot
 *
 * Screenshots are saved to e2e/screenshots/
 */
import { test } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

test('capture screenshot', async ({ page }) => {
  const urlPath = process.env.E2E_PATH || '/'
  const name = process.env.E2E_SCREENSHOT_NAME || urlPath.replace(/\//g, '-').replace(/^-/, '') || 'home'

  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto(urlPath)

  // Wait for the page to settle (network idle + no loading spinners)
  await page.waitForLoadState('networkidle')

  const filePath = path.resolve(screenshotDir, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: true })

  console.log(`Screenshot saved: ${filePath}`)
})
