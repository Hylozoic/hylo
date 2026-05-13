import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch H — “My” streams, `UserSettings` under `/my/*`, global search, themes.
 * Runs on `chromium` and `mobile-chrome`. Requires E2E seed + `auth.setup.js` session.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

async function expectAuthedShell (page, urlPattern) {
  await expect(page).toHaveURL(urlPattern, navTimeout)
  await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
  await expect(page).toHaveTitle(/Hylo/i, uiTimeout)
}

test.describe('Batch H: My streams & redirect', () => {
  test('GET /my redirects to /my/posts', async ({ page }) => {
    await page.goto('/my')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/my\/posts/, navTimeout)
  })

  test('GET /my/posts loads My Posts stream', async ({ page }) => {
    await page.goto('/my/posts')
    await waitPastRootSessionLoading(page)
    await expectAuthedShell(page, /\/my\/posts/)
    await expect(page).toHaveTitle(/Posts \| my \| Hylo/i, uiTimeout)
  })

  test('GET /my/interactions loads Interactions', async ({ page }) => {
    await page.goto('/my/interactions')
    await waitPastRootSessionLoading(page)
    await expectAuthedShell(page, /\/my\/interactions/)
    await expect(page).toHaveTitle(/Interactions \| my \| Hylo/i, uiTimeout)
  })

  test('GET /my/announcements loads Announcements', async ({ page }) => {
    await page.goto('/my/announcements')
    await waitPastRootSessionLoading(page)
    await expectAuthedShell(page, /\/my\/announcements/)
    await expect(page).toHaveTitle(/Announcements \| my \| Hylo/i, uiTimeout)
  })

  test('GET /my/mentions loads Mentions', async ({ page }) => {
    await page.goto('/my/mentions')
    await waitPastRootSessionLoading(page)
    await expectAuthedShell(page, /\/my\/mentions/)
    await expect(page).toHaveTitle(/Mentions \| my \| Hylo/i, uiTimeout)
  })

  test('GET /my/saved-posts loads Saved Posts', async ({ page }) => {
    await page.goto('/my/saved-posts')
    await waitPastRootSessionLoading(page)
    await expectAuthedShell(page, /\/my\/saved-posts/)
    await expect(page).toHaveTitle(/Saved Posts \| my \| Hylo/i, uiTimeout)
  })

  test('GET /my/tracks loads My Tracks shell', async ({ page }) => {
    await page.goto('/my/tracks')
    await waitPastRootSessionLoading(page)
    await expectAuthedShell(page, /\/my\/tracks/)
    await expect(page.getByText('My Tracks').first()).toBeVisible(uiTimeout)
  })
})

test.describe('Batch H: User settings under /my/*', () => {
  test('GET /my/edit-profile loads edit profile', async ({ page }) => {
    await page.goto('/my/edit-profile')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/my\/edit-profile/, navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page.getByRole('heading', { name: /Edit Your Profile/i })).toBeVisible(uiTimeout)
    await expect(page.locator('#center-column [data-testid="loading-indicator"]')).toHaveCount(0, {
      timeout: 90000
    })
    await expect(page.locator('#nameField')).toBeVisible(uiTimeout)
  })

  test('GET /my/notifications loads notification settings tab', async ({ page }) => {
    await page.goto('/my/notifications')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/my\/notifications/, navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page).toHaveTitle(/Hylo/i, uiTimeout)
  })
})

test.describe('Batch H: search & themes', () => {
  test('GET /search loads search shell', async ({ page }) => {
    await page.goto('/search')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/search/, navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(
      page.getByPlaceholder(/Search for people, posts and comments/i)
    ).toBeVisible(uiTimeout)
  })

  test('GET /themes loads theme preview', async ({ page }) => {
    await page.goto('/themes')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/themes$/, navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page.getByRole('heading', { name: /Light Mode/i })).toBeVisible(uiTimeout)
  })
})
