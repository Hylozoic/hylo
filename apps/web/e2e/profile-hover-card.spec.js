import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Issue #1599 — hovering (desktop) or long-pressing (mobile web) a person's avatar opens a
 * profile hover card. Seeded posts in `e2e-public-group` are by the E2E user, who holds the
 * Administrator role there (`scripts/seed-e2e-baseline.js`), so the card shows that role and,
 * being the viewer's own card, no Message button.
 */

test.describe.configure({ timeout: 120000 })

const uiTimeout = { timeout: 60000 }
const STREAM_PATH = '/groups/e2e-public-group/stream'
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

async function firstPostAvatar (page) {
  await page.goto(STREAM_PATH)
  await waitPastRootSessionLoading(page)
  const avatar = page.locator('#center-column [data-profile-hover-card-trigger]').first()
  await expect(avatar).toBeVisible(uiTimeout)
  return avatar
}

async function expectCard (page) {
  const card = page.getByTestId('profile-hover-card')
  await expect(card).toBeVisible(uiTimeout)
  await expect(card.getByText('E2E User')).toBeVisible(uiTimeout)
  await expect(card.getByTestId('profile-card-roles')).toContainText('Administrator', uiTimeout)
  await expect(card.getByRole('button', { name: 'View Profile' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Message' })).toHaveCount(0)
  return card
}

function saveScreenshot (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  return page.screenshot({ path: path.resolve(screenshotDir, name) })
}

test.describe('Profile hover card', () => {
  test('opens on hover over a feed avatar and closes on Escape', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover is desktop-only; see the long-press test')
    const avatar = await firstPostAvatar(page)
    await avatar.hover()
    await expectCard(page)
    await saveScreenshot(page, 'issue-1599-desktop-hover.png')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('profile-hover-card')).toHaveCount(0)
  })

  test('stays open while the pointer moves onto the card, and links to the profile', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover is desktop-only')
    const avatar = await firstPostAvatar(page)
    await avatar.hover()
    const card = await expectCard(page)
    await card.getByRole('button', { name: 'View Profile' }).click()
    await expect(page).toHaveURL(/\/members\/1/, uiTimeout)
  })

  test('opens on long press without following the avatar link', async ({ page, isMobile, browserName }) => {
    test.skip(!isMobile || browserName !== 'chromium', 'long press is checked on the mobile-chrome project')
    const avatar = await firstPostAvatar(page)
    const box = await avatar.boundingBox()
    const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), id: 1 }
    const startUrl = page.url()

    // Playwright has no long-press gesture; drive raw touch events through CDP
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    await page.waitForTimeout(800)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    await expectCard(page)
    expect(page.url()).toBe(startUrl)
    await saveScreenshot(page, 'issue-1599-mobile-long-press.png')

    // Tapping outside closes it
    await page.touchscreen.tap(10, Math.round((page.viewportSize().height) - 40))
    await expect(page.getByTestId('profile-hover-card')).toHaveCount(0, uiTimeout)
  })
})
