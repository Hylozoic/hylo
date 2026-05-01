import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch B — global **`/all`** context (`Stream`, `MapExplorer`, `AllTopics`, `MemberProfile`).
 * Runs on `chromium` and `mobile-chrome`. Requires E2E seed + `auth.setup.js` session.
 *
 * `E2E_SEEDED_USER_ID`: baseline seed inserts the login user first in an empty `hylo_e2e` DB (id `1`).
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

/** First user row from `scripts/seed-e2e-baseline.js` in a fresh E2E database */
const E2E_SEEDED_USER_ID = '1'

async function expectAllContextShell (page, urlPattern) {
  await expect(page).toHaveURL(urlPattern, navTimeout)
  await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
  await expect(page).toHaveTitle(/Hylo/i, uiTimeout)
}

test.describe('Batch B: global context /all', () => {
  test('GET /all/stream loads All stream', async ({ page }) => {
    await page.goto('/all/stream')
    await waitPastRootSessionLoading(page)
    await expectAllContextShell(page, /\/all\/stream/)
  })

  test('GET /all/map loads All map', async ({ page }) => {
    await page.goto('/all/map')
    await waitPastRootSessionLoading(page)
    await expectAllContextShell(page, /\/all\/map/)
  })

  test('GET /all/topics loads topic directory', async ({ page }) => {
    await page.goto('/all/topics')
    await waitPastRootSessionLoading(page)
    await expectAllContextShell(page, /\/all\/topics$/)
  })

  test('GET /all/topics/:topicName loads topic stream', async ({ page }) => {
    await page.goto('/all/topics/e2e-smoke-topic')
    await waitPastRootSessionLoading(page)
    await expectAllContextShell(page, /\/all\/topics\/e2e-smoke-topic/)
  })

  test('GET /all/projects loads projects stream', async ({ page }) => {
    await page.goto('/all/projects')
    await waitPastRootSessionLoading(page)
    await expectAllContextShell(page, /\/all\/projects/)
  })

  test('GET /all/proposals loads proposals stream', async ({ page }) => {
    await page.goto('/all/proposals')
    await waitPastRootSessionLoading(page)
    await expectAllContextShell(page, /\/all\/proposals/)
  })

  test('GET /all/events loads events stream', async ({ page }) => {
    await page.goto('/all/events')
    await waitPastRootSessionLoading(page)
    await expectAllContextShell(page, /\/all\/events/)
  })

  test('GET /all/members/:id loads member profile (All context)', async ({ page }) => {
    await page.goto(`/all/members/${E2E_SEEDED_USER_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/all/members/${E2E_SEEDED_USER_ID}`),
      navTimeout
    )
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page).toHaveTitle(/E2E User|Hylo/i, uiTimeout)
  })
})
