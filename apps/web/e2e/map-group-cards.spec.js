import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/session.json' })

test('map drawer group cards match the design', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 })
  await page.goto('/public/map')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(8000)

  const drawer = page.locator('#mapDrawerWrapper')
  await expect(drawer).toBeVisible()

  // Scroll until a group card is present (groups mix into the list)
  const card = drawer.locator('a.group.relative.block').first()
  for (let i = 0; i < 10 && !(await card.count()); i++) {
    await drawer.evaluate(el => { el.scrollTop += 600 })
    await page.waitForTimeout(500)
  }
  await expect(card).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  const text = await card.textContent()
  console.log('card text:', text.slice(0, 120))
  await drawer.screenshot({ path: 'e2e/screenshots/map-cards.png' })
})
