import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch L — `/create-group`, join via access code, invite token (`seed-e2e-baseline.js`).
 * Serial so invite token use stays deterministic under `fullyParallel`.
 */

test.describe('Batch L: create group & happy-path join', () => {
  test.describe.configure({ mode: 'serial', timeout: 120000 })

  const navTimeout = { timeout: 90000 }
  const uiTimeout = { timeout: 60000 }

  /** Mirrors `apps/backend/scripts/seed-e2e-baseline.js` */
  const JOIN_CODE_SLUG = 'e2e-join-code-group'
  const JOIN_ACCESS_CODE = 'e2ejoincode001'
  const INVITE_TOKEN_GROUP_SLUG = 'e2e-invite-token-group'
  const INVITE_TOKEN = 'e2e-static-invite-token-001'

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

  test('GET /h/use-invitation?token=… lands in invited group', async ({ page }) => {
    await page.goto(`/h/use-invitation?token=${encodeURIComponent(INVITE_TOKEN)}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${INVITE_TOKEN_GROUP_SLUG}/`),
      navTimeout
    )
  })

  test('GET /groups/:slug/join/:accessCode lands in group', async ({ page }) => {
    await page.goto(`/groups/${JOIN_CODE_SLUG}/join/${JOIN_ACCESS_CODE}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${JOIN_CODE_SLUG}/`),
      navTimeout
    )
  })
})
