import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { themes } from '../src/themes/index.js'

/**
 * D75: screenshots of the feed, a post and group settings in every theme, light and
 * dark, for the designer's review of the muted text colour (text-foreground-muted).
 * The contrast itself is checked by src/themes/contrast.test.js; this spec also checks
 * that the app's own appearance code sets the muted colour variable for the signed-in
 * person's theme, and that swept text (a post card's date) is drawn in it. Runs last
 * in the round's final pass, after the sweep. Screenshots go to
 * e2e/screenshots/theme-contrast.
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

// The theme variables the app applied from the person's settings (AppearanceSync)
function appliedVariables (page) {
  return page.evaluate(() => {
    const style = window.getComputedStyle(document.documentElement)
    return {
      mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      background: style.getPropertyValue('--background').trim(),
      muted: style.getPropertyValue('--foreground-muted').trim()
    }
  })
}

// The colour of the first post card date, and the colour the muted variable resolves
// to right now, both as the browser computes them
function dateAndMutedColors (page) {
  return page.evaluate(() => {
    const date = document.querySelector('[data-testid="post-card"] [data-tooltip-id^="dateTip-"]')
    if (!date) return null
    const probe = document.createElement('span')
    probe.style.color = 'hsl(var(--foreground-muted) / 1)'
    document.body.appendChild(probe)
    const muted = window.getComputedStyle(probe).color
    probe.remove()
    return { date: window.getComputedStyle(date).color, muted }
  })
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

  await page.goto(`/groups/${GROUP}/stream`)
  await waitPastRootSessionLoading(page)
  await expect(page.locator('#center-column')).toBeVisible(uiTimeout)

  // Before this spec changes anything: the app set the muted colour of the person's
  // own theme (found by its background) along with the rest of it
  await expect.poll(async () => (await appliedVariables(page)).muted, uiTimeout).not.toBe('')
  const applied = await appliedVariables(page)
  const matching = Object.values(themes)
    .map(theme => theme[applied.mode])
    .filter(colors => colors.background === applied.background)
  expect(matching.length).toBeGreaterThan(0)
  expect(matching.map(colors => colors['foreground-muted'])).toContain(applied.muted)

  // Swept text is drawn in the muted colour, in the app's own theme and in each one
  const hasDate = await page.getByTestId('post-card').first().waitFor({ state: 'visible', timeout: 30000 }).then(() => true, () => false)
  if (hasDate) {
    const colors = await dateAndMutedColors(page)
    expect(colors).not.toBeNull()
    expect(colors.date).toBe(colors.muted)
  }

  for (const { name: pageName, path: pagePath } of pages) {
    await page.goto(pagePath)
    await waitPastRootSessionLoading(page)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    const checkDate = pageName === 'feed' && hasDate
    if (checkDate) await expect(page.getByTestId('post-card').first()).toBeVisible(uiTimeout)
    for (const theme of Object.keys(themes)) {
      for (const mode of ['light', 'dark']) {
        await applyTheme(page, theme, mode)
        if (checkDate) {
          const colors = await dateAndMutedColors(page)
          expect(colors.date, `${theme} ${mode}`).toBe(colors.muted)
        }
        await capture(page, `${pageName}-${theme}-${mode}`)
      }
    }
  }

  // A post, opened from the feed
  await page.goto(`/groups/${GROUP}/stream`)
  await waitPastRootSessionLoading(page)
  const firstPost = page.getByTestId('post-card').first()
  const hasPost = await firstPost.waitFor({ state: 'visible', timeout: 30000 }).then(() => true, () => false)
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
