/**
 * Visual verification for the Add Space modal title, which now names where the
 * space will land: "the main menu" when opened from the group menu, or
 * "More Spaces" when opened off-menu (addToMenu={false}).
 *
 * Both routes render an Add control, so each case scopes its click: the More
 * Spaces page owns the one inside #center-column-container, while the group
 * menu's lives in the sidebar outside it.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP = 'e2e-public-group'

test.use({ storageState: 'e2e/.auth/session.json' })

// Vite's cold dep-prebundle can hold the app on its loading splash well past the 30s default.
test.setTimeout(240000)

async function awaitDialogHeading (page) {
  const heading = page.locator('h2', { hasText: /Create a new space in/ })
  await expect(heading).toBeVisible({ timeout: 20000 })
  return heading
}

/** Off-menu: the More Spaces page's own add card opens the dialog directly. */
async function openFromMoreSpaces (page) {
  await page.locator('#center-column-container').getByRole('button', { name: 'Add to More Spaces' }).click()
  return awaitDialogHeading(page)
}

/** On-menu: the sidebar menu's Add control, then its Add Space item. */
async function openFromMenu (page) {
  await page.getByRole('button', { name: 'Add to Menu' }).first().click()
  await page.getByText('Add Space', { exact: true }).click()
  return awaitDialogHeading(page)
}

test('Add Space modal title names its destination', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto(`/groups/${GROUP}/more-spaces?edit=true`)
  await waitPastRootSessionLoading(page)
  await page.waitForLoadState('networkidle')
  let heading = await openFromMoreSpaces(page)
  console.log('MORE SPACES title:', JSON.stringify(await heading.textContent()))
  await expect(heading).toHaveText(/More Spaces/)
  await page.screenshot({ path: path.resolve(screenshotDir, 'add-space-title-more-spaces.png') })

  // On-menu: the sidebar's group-menu Add (ContextMenu's default addToMenu).
  // Reload first — the dialog has no Escape handler, so a fresh page clears it.
  await page.goto(`/groups/${GROUP}/more-spaces?edit=true`)
  await waitPastRootSessionLoading(page)
  await page.waitForLoadState('networkidle')
  heading = await openFromMenu(page)
  console.log('MAIN MENU title:', JSON.stringify(await heading.textContent()))
  await expect(heading).toHaveText(/the main menu/)
  await page.screenshot({ path: path.resolve(screenshotDir, 'add-space-title-main-menu.png') })
})
