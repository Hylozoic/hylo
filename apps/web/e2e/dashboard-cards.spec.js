/**
 * Visual verification for the one-column dashboard card redesign:
 * postType-colored cards with staggered icon-field backgrounds.
 *
 * Run: node scripts/run-isolated-e2e.js dashboard-cards --project=chromium
 */
import { test } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

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

  // Force the card menu for this user so any group renders one-column
  await page.goto('/my/appearance')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Card Menu' }).click()
  // let the updateMe mutation persist
  await page.waitForTimeout(1000)

  await page.goto('/groups/e2e-public-group')
  await page.waitForLoadState('networkidle')
  // wait for the group views to load and cards to render
  await page.locator('text=Loading views').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1000)

  await page.screenshot({
    path: path.resolve(screenshotDir, 'dashboard-cards.png'),
    fullPage: true
  })
  console.log('Screenshot saved: dashboard-cards.png')

  // Hover a card to capture the colored ring + lift state
  const firstCard = page.locator('.ContextMenuGrid [role="button"]').first()
  await firstCard.hover()
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.resolve(screenshotDir, 'dashboard-cards-hover.png'),
    fullPage: false
  })
  console.log('Screenshot saved: dashboard-cards-hover.png')
})
