import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch I — group settings (`/groups/:slug/settings/*`) and group moderation (`/groups/:slug/moderation/*` only).
 * There is no moderation route under global `/all`, `/public`, or `/my`.
 * Requires E2E seed: Coordinator group role + Administration responsibility linked for the login user
 * (`scripts/seed-e2e-baseline.js`).
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

const PUBLIC_GROUP_SLUG = 'e2e-public-group'
const PRIVATE_GROUP_SLUG = 'e2e-private-group'

function groupPath (slug, rest) {
  const r = rest.startsWith('/') ? rest : `/${rest}`
  return `/groups/${slug}${r}`
}

test.describe('Batch I: group settings', () => {
  test('GET …/settings loads default Settings tab', async ({ page }) => {
    await page.goto(groupPath(PUBLIC_GROUP_SLUG, '/settings'))
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/settings/?$`), navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(
      page.getByRole('heading', { name: /Default notification settings/i })
    ).toBeVisible(uiTimeout)
    await expect(page).toHaveTitle(/Hylo/i, uiTimeout)
  })

  test('GET …/settings/privacy loads Privacy & Access tab', async ({ page }) => {
    await page.goto(groupPath(PUBLIC_GROUP_SLUG, '/settings/privacy'))
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/settings/privacy`), navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page.getByRole('heading', { name: /^Visibility$/i })).toBeVisible(uiTimeout)
  })
})

test.describe('Batch I: moderation (group workspace only)', () => {
  test('GET /groups/:slug/moderation loads shell', async ({ page }) => {
    await page.goto(groupPath(PRIVATE_GROUP_SLUG, '/moderation'))
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${PRIVATE_GROUP_SLUG}/moderation`), navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page.locator('#outer-container')).toBeVisible(uiTimeout)
    // Helmet briefly uses `context` before `group` hydrates — avoid asserting exact pipe segments
    await expect(page).toHaveTitle(/Moderation.*Hylo/i, uiTimeout)
  })
})
