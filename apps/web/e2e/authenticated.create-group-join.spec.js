import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch L — `/create-group` (`seed-e2e-baseline.js`).
 * Join / invite → `/about` flows live in Batch Q: `authenticated.invitation-links-about.spec.js`.
 */

test.describe('Batch L: create group', () => {
  test.describe.configure({ mode: 'serial', timeout: 120000 })

  const navTimeout = { timeout: 90000 }
  const uiTimeout = { timeout: 60000 }

  test.beforeEach(({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())
  })

  test('GET /create-group shows create form', async ({ page }) => {
    await page.goto('/create-group')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/create-group/, navTimeout)
    // Title / placeholders come from i18n — assert stable `CreateGroup` fields instead
    await expect(page.locator('input[name="name"]')).toBeVisible(uiTimeout)
    await expect(page.locator('input[name="slug"]')).toBeVisible(uiTimeout)
  })
})
