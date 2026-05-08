import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch C — global **`/public`** context while authenticated (The Commons).
 * Runs on `chromium` and `mobile-chrome`. Requires E2E seed + `auth.setup.js` session.
 *
 * Router note: there is no `/public/topics` directory route — only `/public/topics/:topicName`.
 * Bare `/public/topics` hits `public/*` and redirects to `/public/stream`.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

async function expectPublicContextShell (page, urlPattern) {
  await expect(page).toHaveURL(urlPattern, navTimeout)
  await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
  await expect(page).toHaveTitle(/Hylo/i, uiTimeout)
}

test.describe('Batch C: global context /public (authenticated)', () => {
  test('GET /public/stream loads Public stream', async ({ page }) => {
    await page.goto('/public/stream')
    await waitPastRootSessionLoading(page)
    await expectPublicContextShell(page, /\/public\/stream/)
  })

  test('GET /public/map loads Public map', async ({ page }) => {
    await page.goto('/public/map')
    await waitPastRootSessionLoading(page)
    await expectPublicContextShell(page, /\/public\/map/)
  })

  test('GET /public/groups loads group explorer', async ({ page }) => {
    await page.goto('/public/groups')
    await waitPastRootSessionLoading(page)
    await expectPublicContextShell(page, /\/public\/groups/)
  })

  test('GET /public/topics/:topicName loads topic stream', async ({ page }) => {
    await page.goto('/public/topics/e2e-smoke-topic')
    await waitPastRootSessionLoading(page)
    await expectPublicContextShell(page, /\/public\/topics\/e2e-smoke-topic/)
  })

  test('GET /public/topics (index) redirects to /public/stream', async ({ page }) => {
    await page.goto('/public/topics')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/public\/stream(\/.*)?$/, navTimeout)
  })

  test('GET /public/projects loads projects stream', async ({ page }) => {
    await page.goto('/public/projects')
    await waitPastRootSessionLoading(page)
    await expectPublicContextShell(page, /\/public\/projects/)
  })

  test('GET /public/proposals loads proposals stream', async ({ page }) => {
    await page.goto('/public/proposals')
    await waitPastRootSessionLoading(page)
    await expectPublicContextShell(page, /\/public\/proposals/)
  })

  test('GET /public/events loads events stream', async ({ page }) => {
    await page.goto('/public/events')
    await waitPastRootSessionLoading(page)
    await expectPublicContextShell(page, /\/public\/events/)
  })
})
