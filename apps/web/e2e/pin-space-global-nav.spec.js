/**
 * #1605: a member pins a space to the global nav from the bottom of the space's
 * About page. The pinned item shows the parent group's avatar full-frame with the
 * space's icon badged in the bottom-right corner; unpinning removes it.
 *
 * chromium and mobile-chrome run in parallel against one seeded user, so each
 * project pins a different seeded space. Every run ends unpinned.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { openGlobalNavDrawerIfNeeded } from './helpers/sessionAuth.js'

test.use({ storageState: 'e2e/.auth/session.json' })
test.describe.configure({ timeout: 240000 })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

const SPACES = {
  // parentInitials: what the parent group's default avatar shows (seeded groups have no avatar image)
  chromium: { parent: 'e2e-one-column-group', space: 'e2e-one-column-space', name: 'E2E One Column Space', parentName: 'E2E One Column Group', parentInitials: 'EO' },
  'mobile-chrome': { parent: 'e2e-public-group', space: 'e2e-test-space', name: 'E2E Test Space', parentName: 'E2E Public Group', parentInitials: 'EP' }
}

const PIN_LABEL = 'Pin space to global navigation'
const UNPIN_LABEL = 'Unpin space from global navigation'

async function openAbout (page, { parent, space }) {
  await page.goto(`/groups/${parent}/spaces/${space}/about`)
  await waitPastRootSessionLoading(page)
  const pinButton = page.getByTestId('space-global-nav-pin')
  await expect(pinButton).toBeVisible({ timeout: 60000 })
  return pinButton
}

function pinnedNavItem (page, name) {
  return page.locator(`[data-testid^="global-nav-space-"][aria-label="${name}"]`)
}

test('pin a space from its About page, see it in the global nav, then unpin it', async ({ page }, testInfo) => {
  const target = SPACES[testInfo.project.name]
  test.skip(!target, 'runs on chromium and mobile-chrome')
  fs.mkdirSync(screenshotDir, { recursive: true })
  const shot = name => path.resolve(screenshotDir, `issue-1605-${testInfo.project.name}-${name}.png`)

  let pinButton = await openAbout(page, target)

  // A previous failed run may have left it pinned
  if (await pinButton.getAttribute('aria-pressed') === 'true') {
    await pinButton.click()
    await expect(pinButton).toHaveAttribute('aria-pressed', 'false')
  }

  // The pin control sits at the bottom of the About page, beside Leave Space
  await expect(pinButton).toHaveText(PIN_LABEL)
  await expect(pinButton.locator('xpath=..').getByRole('button', { name: 'Leave Space' })).toBeVisible()
  await pinButton.scrollIntoViewIfNeeded()
  await page.screenshot({ path: shot('about-unpinned') })

  await pinButton.click()
  await expect(pinButton).toHaveText(UNPIN_LABEL)
  await expect(pinButton).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: shot('about-pinned') })

  // Survives a reload, so the pin was saved, not just applied optimistically
  await page.reload()
  await waitPastRootSessionLoading(page)
  await openGlobalNavDrawerIfNeeded(page)
  const navItem = pinnedNavItem(page, target.name)
  await expect(navItem).toHaveCount(1, { timeout: 60000 })
  await navItem.scrollIntoViewIfNeeded()
  await expect(navItem).toBeVisible()

  // The parent group's avatar fills the tile (an image, or the default avatar's
  // initials of the PARENT's name, not the space's); the space's icon is a small corner badge
  const tileBackground = await navItem.evaluate(el => el.style.backgroundImage)
  if (!tileBackground.startsWith('url(')) {
    await expect(navItem.locator('.GlobalNavItemDefaultAvatarText')).toHaveText(target.parentInitials)
  }
  const badge = navItem.locator('[data-testid^="pinned-space-badge-"]')
  await expect(badge).toBeVisible()
  const [tileBox, badgeBox] = await Promise.all([navItem.boundingBox(), badge.boundingBox()])
  expect(badgeBox.width).toBeLessThan(tileBox.width / 2)
  expect(badgeBox.x + badgeBox.width / 2).toBeGreaterThan(tileBox.x + tileBox.width / 2)
  expect(badgeBox.y + badgeBox.height / 2).toBeGreaterThan(tileBox.y + tileBox.height / 2)

  // The nav item opens the space and shows as selected there
  await navItem.click()
  await expect(page).toHaveURL(new RegExp(`/groups/${target.parent}/spaces/${target.space}`), { timeout: 30000 })
  await openGlobalNavDrawerIfNeeded(page)
  await expect(navItem).toHaveClass(/border-selected/)
  // ...and its parent group's own item doesn't also show as selected
  await expect(page.locator(`.GlobalNavItem [aria-label="${target.parentName}"]`)).not.toHaveClass(/border-selected/)
  await page.screenshot({ path: shot('global-nav-pinned') })
  await navItem.screenshot({ path: shot('global-nav-item'), animations: 'disabled' }).catch(() => {})

  // Unpin from the About page and the nav item goes away
  pinButton = await openAbout(page, target)
  await expect(pinButton).toHaveText(UNPIN_LABEL)
  await pinButton.click()
  await expect(pinButton).toHaveText(PIN_LABEL)
  await expect(pinButton).toHaveAttribute('aria-pressed', 'false')

  await page.reload()
  await waitPastRootSessionLoading(page)
  await openGlobalNavDrawerIfNeeded(page)
  await expect(pinnedNavItem(page, target.name)).toHaveCount(0, { timeout: 30000 })
})
