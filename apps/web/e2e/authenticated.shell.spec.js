import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch A — authenticated shell & redirects (`AuthLayoutRouter` + top-level stubs).
 * Runs on `chromium` and `mobile-chrome` (saved session from `auth.setup.js`).
 * Requires E2E seed / login: `e2e.user@hylo.test` with groups including `e2e-public-group`, `e2e-private-group`, and often `e2e-paywall-group` (last-viewed after other E2E batches).
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

test.describe('Batch A: authenticated shell & redirects', () => {
  test('GET / lands on /all or a seeded group', async ({ page }) => {
    await page.goto('/')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      /\/(all(\/.*)?$|groups\/e2e-(public|private|paywall)-group(\/.*)?$)/,
      navTimeout
    )
    await expect(page).toHaveTitle(/Hylo/i, uiTimeout)
  })

  test('GET /notifications redirects to /my/notifications', async ({ page }) => {
    await page.goto('/notifications')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/my\/notifications/, navTimeout)
  })

  test('GET /settings/edit-profile loads legacy user settings', async ({ page }) => {
    await page.goto('/settings/edit-profile')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/settings\/edit-profile/, navTimeout)
    await expect(page).toHaveTitle(/Edit Your Profile \| Hylo/i, uiTimeout)
    await expect(page.getByLabel(/Name/i).first()).toBeVisible(uiTimeout)
  })

  test('GET /public redirects to /public/stream', async ({ page }) => {
    await page.goto('/public')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/public\/stream(\/.*)?$/, navTimeout)
  })

  test('GET /all/members redirects to /all', async ({ page }) => {
    await page.goto('/all/members')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/all(\/.*)?$/, navTimeout)
    await expect(page).not.toHaveURL(/\/all\/members/, navTimeout)
  })

  test('GET /all/settings redirects to /all', async ({ page }) => {
    await page.goto('/all/settings')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/all(\/.*)?$/, navTimeout)
    await expect(page).not.toHaveURL(/\/all\/settings/, navTimeout)
  })

  test('GET /public/members redirects toward public stream', async ({ page }) => {
    await page.goto('/public/members')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/public\/stream(\/.*)?$/, navTimeout)
  })

  test('GET /public/settings redirects toward public stream', async ({ page }) => {
    await page.goto('/public/settings')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/public\/stream(\/.*)?$/, navTimeout)
  })
})
