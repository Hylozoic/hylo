import { test, expect } from '@playwright/test'
import { dismissCookiePreferencesIfOpen } from './helpers/sessionAuth.js'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch F — members list & profiles (`MemberProfile`, `Members`).
 * Seeded user id `1` (`e2e.user@hylo.test`), public group `e2e-public-group`.
 *
 * `/groups/:slug/members` (list only) is also exercised in Batch D; this file focuses on
 * profiles and `members/create`.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

const E2E_USER_ID = '1'
const PUBLIC_GROUP_SLUG = 'e2e-public-group'

async function expectProfileShell (page, urlPattern) {
  await dismissCookiePreferencesIfOpen(page)
  await expect(page).toHaveURL(urlPattern, navTimeout)
  await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
  await expect(page.getByRole('heading', { level: 1, name: /E2E User/i })).toBeVisible(uiTimeout)
  await expect(page).toHaveTitle(/E2E User|Hylo/i, uiTimeout)
}

test.describe('Batch F: members & profiles', () => {
  test('GET /members/:id loads global member profile', async ({ page }) => {
    await page.goto(`/members/${E2E_USER_ID}`)
    await waitPastRootSessionLoading(page)
    await expectProfileShell(page, new RegExp(`/members/${E2E_USER_ID}`))
  })

  test('GET /groups/:slug/members/:id loads profile in group context', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/members/${E2E_USER_ID}`)
    await waitPastRootSessionLoading(page)
    await expectProfileShell(
      page,
      new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/members/${E2E_USER_ID}`)
    )
  })

  test('GET /groups/:slug/members/create loads invite / add-members shell', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/members/create`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/members/create`),
      navTimeout
    )
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page.locator('#members-page')).toBeVisible(uiTimeout)
    await expect(page).toHaveTitle(/E2E Public Group|Hylo/i, uiTimeout)
  })
})
