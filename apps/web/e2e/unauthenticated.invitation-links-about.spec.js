import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import {
  HIDDEN_JOIN_ACCESS_CODE,
  HIDDEN_JOIN_GROUP_SLUG,
  JOIN_ACCESS_CODE,
  JOIN_CODE_GROUP_SLUG,
  PAYWALL_GROUP_SLUG,
  PRIVATE_GROUP_SLUG,
  PUBLIC_GROUP_SLUG,
  expectGroupDetailAboutLoaded,
  expectUnauthenticatedAboutJoinGate,
  seededGroupTitlePattern
} from './helpers/invitationLinksSeed.js'

/**
 * Batch Q — unauthenticated paths to group about / join entry
 * (`INVITATION_LINKS_ARCHITECTURE.md`). Uses `chromium-unauth` / `mobile-unauth` storageState.
 */

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies()
  await page.goto('about:blank')
  await page.evaluate(() => {
    try {
      window.localStorage.clear()
      window.sessionStorage.clear()
    } catch (e) {}
  })
  page.on('dialog', (dialog) => dialog.accept())
})

const uiTimeout = { timeout: 60000 }
const routeTimeout = { timeout: 60000 }
const gotoOpts = { waitUntil: 'domcontentloaded' }

/**
 * Cookie consent toast can sit above CTAs on mobile.
 * @param {import('@playwright/test').Page} page
 */
async function dismissCookieConsentBannerIfPresent (page) {
  const btn = page.getByRole('button', { name: /Reject Non-Essential/i })
  try {
    await btn.waitFor({ state: 'visible', timeout: 4000 })
    await btn.click()
  } catch {
    // Banner absent or already dismissed
  }
}

test.describe('Batch Q: public / hidden about (unauthenticated)', () => {
  test('GET /groups/:slug/about shows seeded public group (no login)', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/about`, gotoOpts)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/about`), routeTimeout)
    await expect(page).toHaveTitle(seededGroupTitlePattern('E2E Public Group'), uiTimeout)
    await expectGroupDetailAboutLoaded(page, uiTimeout)
    await expectUnauthenticatedAboutJoinGate(page, 'E2E Public Group', uiTimeout)
  })

  test('GET /groups/:slug/about for hidden group without invite sends user to login', async ({ page }) => {
    await page.goto(`/groups/${PRIVATE_GROUP_SLUG}/about`, gotoOpts)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/login/, routeTimeout)
  })

  test('GET /groups/:slug/about?accessCode= grants visibility for restricted public group', async ({ page }) => {
    await page.goto(
      `/groups/${JOIN_CODE_GROUP_SLUG}/about?accessCode=${encodeURIComponent(JOIN_ACCESS_CODE)}`,
      gotoOpts
    )
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${JOIN_CODE_GROUP_SLUG}/about`),
      routeTimeout
    )
    await expect(page).toHaveTitle(seededGroupTitlePattern('E2E Join Code Group'), uiTimeout)
    await expectGroupDetailAboutLoaded(page, uiTimeout)
    await expectUnauthenticatedAboutJoinGate(page, 'E2E Join Code Group', uiTimeout)
  })

  test('GET /groups/:slug/about for dedicated hidden+join group without code sends user to login', async ({ page }) => {
    await page.goto(`/groups/${HIDDEN_JOIN_GROUP_SLUG}/about`, gotoOpts)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/login/, routeTimeout)
  })

  test('GET /groups/:slug/about?accessCode= grants visibility for hidden group with join code', async ({ page }) => {
    await page.goto(
      `/groups/${HIDDEN_JOIN_GROUP_SLUG}/about?accessCode=${encodeURIComponent(HIDDEN_JOIN_ACCESS_CODE)}`,
      gotoOpts
    )
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${HIDDEN_JOIN_GROUP_SLUG}/about`), routeTimeout)
    await expect(page).toHaveTitle(seededGroupTitlePattern('E2E Hidden Join Group'), uiTimeout)
    await expectGroupDetailAboutLoaded(page, uiTimeout)
    await expectUnauthenticatedAboutJoinGate(page, 'E2E Hidden Join Group', uiTimeout)
  })
})

test.describe('Batch Q: join link entry (unauthenticated)', () => {
  test('GET /groups/:slug/join/:accessCode sends guest to signup (return path stored for after auth)', async ({ page }) => {
    await page.goto(`/groups/${JOIN_CODE_GROUP_SLUG}/join/${JOIN_ACCESS_CODE}`, gotoOpts)
    await expect(page).toHaveURL(/\/signup\/?/, routeTimeout)
    await waitPastRootSessionLoading(page)
  })

  test('GET /groups/:slug/join/:accessCode for hidden group sends guest to signup', async ({ page }) => {
    await page.goto(`/groups/${HIDDEN_JOIN_GROUP_SLUG}/join/${HIDDEN_JOIN_ACCESS_CODE}`, gotoOpts)
    await expect(page).toHaveURL(/\/signup\/?/, routeTimeout)
    await waitPastRootSessionLoading(page)
  })
})

test.describe('Batch Q: paywall about path (unauthenticated)', () => {
  test('GET /groups/:slug/about shows paywall copy for seeded paywall group', async ({ page }) => {
    await page.goto(`/groups/${PAYWALL_GROUP_SLUG}/about`, gotoOpts)
    await waitPastRootSessionLoading(page)
    await dismissCookieConsentBannerIfPresent(page)
    await expect(page.getByRole('heading', { name: /This group requires a fee to join/i })).toBeVisible(
      uiTimeout
    )
  })
})
