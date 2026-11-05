import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { themes } from '../src/themes/index.js'

/**
 * D75: screenshots of the feed, a post and group settings in every theme, light and
 * dark, for the designer's review of the muted text colour (text-foreground-muted).
 * The contrast itself is checked by src/themes/contrast.test.js; this spec also checks
 * that the page picked up the muted colour variable. Runs last in the round's final
 * pass, after the sweep. Screenshots go to e2e/screenshots/theme-contrast.
 * Requires the E2E seed (e2e.user in e2e-public-group, which has posts).
 */

test.use({ storageState: 'e2e/.auth/session.json' })
test.describe.configure({ timeout: 600000 })

const uiTimeout = { timeout: 60000 }
const GROUP = 'e2e-public-group'
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots', 'theme-contrast')

// Applies a theme the way the app does (src/util/appearance.js), without saving it
async function applyTheme (page, name, mode) {
  await page.evaluate(({ colors, mode }) => {
    Object.entries(colors).forEach(([key, value]) => document.documentElement.style.setProperty(`--${key}`, value))
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(mode)
    document.documentElement.style.colorScheme = mode
  }, { colors: themes[name][mode], mode })
}

async function capture (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({ path: path.resolve(screenshotDir, `${name}.png`), animations: 'disabled' })
}

const pages = [
  { name: 'feed', path: `/groups/${GROUP}/stream` },
  { name: 'settings', path: `/groups/${GROUP}/settings` }
]

test('the muted text colour in every theme and mode', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only screenshots')

  for (const { name: pageName, path: pagePath } of pages) {
    await page.goto(pagePath)
    await waitPastRootSessionLoading(page)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    for (const theme of Object.keys(themes)) {
      for (const mode of ['light', 'dark']) {
        await applyTheme(page, theme, mode)
        const muted = await page.evaluate(() => window.getComputedStyle(document.documentElement).getPropertyValue('--foreground-muted').trim())
        expect(muted).toBe(themes[theme][mode]['foreground-muted'])
        await capture(page, `${pageName}-${theme}-${mode}`)
      }
    }
  }

  // A post, opened from the feed
  await page.goto(`/groups/${GROUP}/stream`)
  await waitPastRootSessionLoading(page)
  const firstPost = page.getByTestId('post-card').first()
  const hasPost = await firstPost.isVisible({ timeout: 30000 }).catch(() => false)
  test.skip(!hasPost, 'no post to open in the seeded group')
  await firstPost.click()
  await expect(page).toHaveURL(/\/post\//, uiTimeout)
  for (const theme of Object.keys(themes)) {
    for (const mode of ['light', 'dark']) {
      await applyTheme(page, theme, mode)
      await capture(page, `post-${theme}-${mode}`)
    }
  }
})
