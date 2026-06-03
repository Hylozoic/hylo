import { test, expect, devices } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch E — post detail routes (`PostDetail` in center vs `#detail-column`).
 * Seeded post: `scripts/seed-e2e-baseline.js` → first post in empty DB is typically id `1`, title “E2E Public Post”, group `e2e-public-group`.
 *
 * Dual-column map routes rely on `AuthLayoutRouter` `hasDetail` (paths containing `map/` + `/post/…`).
 *
 * Post close navigation: `seed-e2e-baseline.js` also inserts posts `2`–`4` and user `e2e.nogroups@hylo.test` (same password as primary E2E user).
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

const E2E_POST_ID = '1'
const E2E_USER_ID = '1'
const PUBLIC_GROUP_SLUG = 'e2e-public-group'

/** Deterministic ids when DB is seeded with `apps/backend/scripts/seed-e2e-baseline.js` only. */
const E2E_POST_MULTI_PUBLIC = '2'
const E2E_POST_ONE_MEMBER_MULTI = '3'
const E2E_POST_MULTI_MEMBER = '4'
const E2E_NOGROUPS_EMAIL = 'e2e.nogroups@hylo.test'
const E2E_LOGIN_PASSWORD = 'e2e-password-123'

/** Must match `playwright.config.js` — manual `browser.newContext()` does not inherit `use.baseURL`. */
function e2eBaseUrl () {
  const webPort = process.env.E2E_WEB_PORT || process.env.PORT || '3000'
  return `http://localhost:${webPort}`
}

async function expectSeededPostVisible (page) {
  await expect(page.getByText(/E2E Public Post/i).first()).toBeVisible(uiTimeout)
}

/**
 * New context with no cookies; `baseURL` is required or relative `goto` resolves against `about:blank`.
 */
async function newLoggedOutContext (browser, contextOptions = {}) {
  const context = await browser.newContext({
    baseURL: e2eBaseUrl(),
    storageState: { cookies: [], origins: [] },
    ...contextOptions
  })
  const page = await context.newPage()
  return { context, page }
}

async function loginOnPage (page, email) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await expect(page).toHaveURL(/\/login/, navTimeout)
  await expect(page.getByRole('heading', { name: /sign in to hylo/i })).toBeVisible(uiTimeout)
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(E2E_LOGIN_PASSWORD)
  await page.getByRole('button', { name: /sign\s*in/i }).click()
  await expect(page.locator('#center-column-container')).toBeVisible(navTimeout)
}

test.describe('Batch E: post detail & dual-column', () => {
  test('GET /post/:id loads post (global)', async ({ page }) => {
    await page.goto(`/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/post/${E2E_POST_ID}`), navTimeout)
    await expectSeededPostVisible(page)
  })

  test('GET /groups/:slug/post/:id loads post in group context', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/post/${E2E_POST_ID}`),
      navTimeout
    )
    await expectSeededPostVisible(page)
  })

  test('GET /all/map/post/:id opens detail column (All map)', async ({ page }) => {
    await page.goto(`/all/map/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/all/map/post/${E2E_POST_ID}`), navTimeout)
    await expect(page.locator('#detail-column')).toBeVisible(uiTimeout)
    await expectSeededPostVisible(page)
  })

  test('GET /public/map/post/:id opens detail column (Public map)', async ({ page }) => {
    await page.goto(`/public/map/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/public/map/post/${E2E_POST_ID}`), navTimeout)
    await expect(page.locator('#detail-column')).toBeVisible(uiTimeout)
    await expectSeededPostVisible(page)
  })

  test('GET /groups/:slug/map/post/:id opens detail column (group map)', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/map/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/map/post/${E2E_POST_ID}`),
      navTimeout
    )
    await expect(page.locator('#detail-column')).toBeVisible(uiTimeout)
    await expectSeededPostVisible(page)
  })

  test('GET /members/:id/post/:id loads post (member route)', async ({ page }) => {
    await page.goto(`/members/${E2E_USER_ID}/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/members/${E2E_USER_ID}/post/${E2E_POST_ID}`),
      navTimeout
    )
    await expectSeededPostVisible(page)
  })
})

/**
 * Isolated `/post/:id` close: `getPostDetailCloseDestination` via ViewHeader back (no in-card X).
 *
 * Scenarios (seeded data):
 * 1. Single group + member → `/groups/e2e-public-group/stream` (post `1`, primary `e2e.user@hylo.test`).
 * 2. Many groups + member of none + public → `/public/stream` (post `2`, `e2e.nogroups@hylo.test`).
 * 3. Many groups + member of exactly one post group → that group’s stream (post `3`, primary user).
 * 4. Many groups + member of several post groups → `/my/groups` (post `4`, primary user).
 */
test.describe('post detail close navigation', () => {
  const mobileViewport = devices['Pixel 5'].viewport

  async function prepareMobilePage (page) {
    await page.setViewportSize(mobileViewport)
  }

  async function closeIsolatedPostDetail (page) {
    await page.locator('header').getByRole('button').first().click()
  }

  test('single group + member: /post/:id close → group stream', async ({ page }) => {
    await prepareMobilePage(page)
    await page.goto(`/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expectSeededPostVisible(page)
    await closeIsolatedPostDetail(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/stream`), navTimeout)
  })

  test('many groups + no memberships + public: close → /public/stream', async ({ browser }) => {
    const { context, page } = await newLoggedOutContext(browser, devices['Pixel 5'])
    try {
      await loginOnPage(page, E2E_NOGROUPS_EMAIL)
      await page.goto(`/post/${E2E_POST_MULTI_PUBLIC}`)
      await waitPastRootSessionLoading(page)
      await expect(page.getByText(/E2E Multi Public Post/i).first()).toBeVisible(uiTimeout)
      await closeIsolatedPostDetail(page)
      await expect(page).toHaveURL(/\/public\/stream/, navTimeout)
    } finally {
      await context.close()
    }
  })

  test('many groups + member of one post group: close → that group stream', async ({ page }) => {
    await prepareMobilePage(page)
    await page.goto(`/post/${E2E_POST_ONE_MEMBER_MULTI}`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByText(/E2E One-Member Multi Post/i).first()).toBeVisible(uiTimeout)
    await closeIsolatedPostDetail(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/stream`), navTimeout)
  })

  test('many groups + member of multiple post groups: close → /my/groups', async ({ page }) => {
    await prepareMobilePage(page)
    await page.goto(`/post/${E2E_POST_MULTI_MEMBER}`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByText(/E2E Multi Member Post/i).first()).toBeVisible(uiTimeout)
    await closeIsolatedPostDetail(page)
    await expect(page).toHaveURL(/\/my\/groups/, navTimeout)
  })
})
