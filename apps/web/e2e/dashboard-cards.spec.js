/**
 * Visual verification for the one-column dashboard card redesign:
 * postType-colored cards with staggered icon-field backgrounds.
 *
 * Uses the seeded one-column group (`e2e-one-column-group`) instead of
 * toggling the shared E2E user's Card Menu preference — that mutation raced
 * parallel suites onto one-column and broke ContextMenu-dependent tests.
 *
 * Run: node scripts/run-isolated-e2e.js dashboard-cards --project=chromium
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const uiTimeout = { timeout: 60000 }

test.describe.configure({ timeout: 120000 })

test('two-column menu active row styling', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile-chrome', 'two-column sidebar is desktop-only')
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/groups/e2e-public-group')
  await waitPastRootSessionLoading(page)
  await page.locator('text=Loading views').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})

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

  // Group settings.layout=one-column — no shared-user preference mutation
  await page.goto('/groups/e2e-one-column-group')
  await waitPastRootSessionLoading(page)
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
})
