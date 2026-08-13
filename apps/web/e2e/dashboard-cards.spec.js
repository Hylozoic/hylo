/**
 * Visual verification for the one-column dashboard card redesign:
 * postType-colored cards with staggered icon-field backgrounds.
 *
 * Run: node scripts/run-isolated-e2e.js dashboard-cards --project=chromium
 *
 * IMPORTANT: toggling Card Menu persists on the shared E2E user. Always reset
 * to Group Default in `finally` so parallel/authenticated suites stay two-column.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const uiTimeout = { timeout: 60000 }

async function setGroupNavStyle (page, ariaLabel) {
  await page.goto('/my/appearance')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: ariaLabel }).click()
  // let the updateMe mutation persist
  await page.waitForTimeout(1000)
}

test('two-column menu active row styling', async ({ page }) => {
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/groups/e2e-public-group')
  await page.waitForLoadState('networkidle')
  await page.locator('text=Loading views').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(500)

  // Open a couple of views so the active-row background is visible
  const menuItems = page.locator('.ContextMenu ul .MenuLink, .ContextMenu ul a')
  const count = await menuItems.count()
  if (count > 1) {
    await menuItems.nth(1).click()
    await page.waitForTimeout(800)
  }
  await page.screenshot({
    path: path.resolve(screenshotDir, 'context-menu-active-row.png'),
    fullPage: false
  })
  console.log('Screenshot saved: context-menu-active-row.png')

  if (count > 2) {
    await menuItems.nth(2).click()
    await page.waitForTimeout(800)
    await page.screenshot({
      path: path.resolve(screenshotDir, 'context-menu-active-row-2.png'),
      fullPage: false
    })
    console.log('Screenshot saved: context-menu-active-row-2.png')

    // Hover a non-active row to capture the fade-in background
    await menuItems.nth(1).hover()
    await page.waitForTimeout(400)
    await page.screenshot({
      path: path.resolve(screenshotDir, 'context-menu-hover-row.png'),
      fullPage: false
    })
    console.log('Screenshot saved: context-menu-hover-row.png')
  }
})

test('one-column dashboard cards', async ({ page }) => {
  fs.mkdirSync(screenshotDir, { recursive: true })

  try {
    // Force the card menu for this user so any group renders one-column
    await setGroupNavStyle(page, 'Card Menu')

    await page.goto('/groups/e2e-public-group')
    await page.waitForLoadState('networkidle')
    // wait for the group views to load and cards to render
    await page.locator('text=Loading views').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})

    const firstCard = page.locator('.ContextMenuGrid [role="button"]').first()
    await expect(firstCard).toBeVisible(uiTimeout)

    await page.screenshot({
      path: path.resolve(screenshotDir, 'dashboard-cards.png'),
      fullPage: true
    })
    console.log('Screenshot saved: dashboard-cards.png')

    // Hover a card to capture the colored ring + lift state
    await firstCard.hover()
    await page.waitForTimeout(300)
    await page.screenshot({
      path: path.resolve(screenshotDir, 'dashboard-cards-hover.png'),
      fullPage: false
    })
    console.log('Screenshot saved: dashboard-cards-hover.png')
  } finally {
    // Reset shared E2E user so other suites keep two-column / Side Menu behavior
    await setGroupNavStyle(page, 'Group Default')
  }
})
