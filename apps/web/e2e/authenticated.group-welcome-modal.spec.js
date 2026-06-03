import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch M — `GroupWelcomeModal` on first visit when membership `showJoinForm` is true.
 * Seeded group `e2e-welcome-overlay` (`seed-e2e-baseline.js`). We assert the overlay only;
 * clicking “Jump in!” would clear `showJoinForm` and break retries / parallel workers.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

const WELCOME_GROUP_SLUG = 'e2e-welcome-overlay'

test.describe('Batch M: group welcome modal', () => {
  test('opening seeded group shows welcome overlay', async ({ page }) => {
    await page.goto(`/groups/${WELCOME_GROUP_SLUG}/stream`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${WELCOME_GROUP_SLUG}/stream`),
      navTimeout
    )
    await expect(page.getByRole('heading', { name: /Welcome to/i })).toBeVisible(uiTimeout)
    await expect(page.getByRole('button', { name: /Jump in/i })).toBeVisible(uiTimeout)
  })
})
