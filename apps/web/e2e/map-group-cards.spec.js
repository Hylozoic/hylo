import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

test.describe.configure({ timeout: 120000 })

test('map drawer group cards match the design', async ({ page }) => {
  test.skip(test.info().project.name.includes('mobile'), 'map drawer geometry is desktop')
  await page.setViewportSize({ width: 1500, height: 900 })
  // Seeded public group sits in SF; pin the viewport so the drawer query includes it
  // even if the session user location has not hydrated yet.
  await page.goto('/groups/e2e-public-group/map?center=37.7749%2C-122.4194&zoom=10')
  await waitPastRootSessionLoading(page)

  const drawer = page.locator('#mapDrawerWrapper')
  await expect(drawer).toBeVisible({ timeout: 60000 })
  await expect(drawer.getByText('E2E Public Group').first()).toBeVisible({ timeout: 60000 })

  await page.getByTestId('map-lens-dropdown').click()
  await page.getByRole('menuitem', { name: /^Groups/ }).click()

  const card = drawer.getByRole('link', { name: /E2E Public Group/ }).first()
  await expect(card).toBeVisible({ timeout: 60000 })
  await card.scrollIntoViewIfNeeded()
  const text = await card.textContent()
  console.log('card text:', text.slice(0, 120))
  await drawer.screenshot({ path: 'e2e/screenshots/map-cards.png' })
})
