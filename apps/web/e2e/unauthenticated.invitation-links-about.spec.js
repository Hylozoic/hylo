import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import {
  JOIN_LINK_FIXTURES,
  INVITE_LINK_FIXTURES,
  PAYWALL_GROUP_SLUG,
  PUBLIC_GROUP_SLUG,
  PRIVATE_GROUP_SLUG,
  expectGroupDetailAboutLoaded,
  expectUnauthenticatedAboutJoinGate,
  seededGroupTitlePattern
} from './helpers/invitationLinksSeed.js'

/**
 * Batch Q — unauthenticated paths to group about / join entry
 * (`INVITATION_LINKS_ARCHITECTURE.md`). Uses `chromium-unauth` / `mobile-unauth` storageState.
 * Matrix: Hidden / Protected / Public × Closed / Restricted (Open excluded).
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

test.describe('Batch Q: baseline about visibility (unauthenticated)', () => {
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
})

test.describe('Batch Q: join links (unauthenticated)', () => {
  for (const fixture of JOIN_LINK_FIXTURES) {
    test(`GET /groups/:slug/join/:accessCode sends guest to signup for ${fixture.label}`, async ({ page }) => {
      await page.goto(`/groups/${fixture.slug}/join/${fixture.accessCode}`, gotoOpts)
      await expect(page).toHaveURL(/\/signup\/?/, routeTimeout)
      await waitPastRootSessionLoading(page)
    })

    test(`GET /groups/:slug/about?accessCode= grants visibility for ${fixture.label}`, async ({ page }) => {
      await page.goto(
        `/groups/${fixture.slug}/about?accessCode=${encodeURIComponent(fixture.accessCode)}`,
        gotoOpts
      )
      await waitPastRootSessionLoading(page)
      await expect(page).toHaveURL(new RegExp(`/groups/${fixture.slug}/about`), routeTimeout)
      await expect(page).toHaveTitle(seededGroupTitlePattern(fixture.groupName), uiTimeout)
      await expectGroupDetailAboutLoaded(page, uiTimeout)
      await expectUnauthenticatedAboutJoinGate(page, fixture.groupName, uiTimeout)
    })

    if (fixture.requiresLoginWithoutLink) {
      test(`GET /groups/:slug/about without join link sends guest to login for ${fixture.label}`, async ({ page }) => {
        await page.goto(`/groups/${fixture.slug}/about`, gotoOpts)
        await waitPastRootSessionLoading(page)
        await expect(page).toHaveURL(/\/login/, routeTimeout)
      })
    } else {
      test(`GET /groups/:slug/about without join link shows signup gate for ${fixture.label}`, async ({ page }) => {
        await page.goto(`/groups/${fixture.slug}/about`, gotoOpts)
        await waitPastRootSessionLoading(page)
        await expect(page).toHaveURL(new RegExp(`/groups/${fixture.slug}/about`), routeTimeout)
        await expect(page).toHaveTitle(seededGroupTitlePattern(fixture.groupName), uiTimeout)
        await expectGroupDetailAboutLoaded(page, uiTimeout)
        await expectUnauthenticatedAboutJoinGate(page, fixture.groupName, uiTimeout)
      })
    }
  }
})

test.describe('Batch Q: invite links (unauthenticated)', () => {
  for (const fixture of INVITE_LINK_FIXTURES) {
    test(`GET /h/use-invitation?token= sends guest to signup for ${fixture.label}`, async ({ page }) => {
      await page.goto(`/h/use-invitation?token=${encodeURIComponent(fixture.token)}`, gotoOpts)
      await expect(page).toHaveURL(/\/signup\/?/, routeTimeout)
      await waitPastRootSessionLoading(page)
    })

    test(`GET /groups/:slug/about?token= grants visibility for ${fixture.label}`, async ({ page }) => {
      await page.goto(
        `/groups/${fixture.slug}/about?token=${encodeURIComponent(fixture.token)}`,
        gotoOpts
      )
      await waitPastRootSessionLoading(page)
      await expect(page).toHaveURL(new RegExp(`/groups/${fixture.slug}/about`), routeTimeout)
      await expect(page).toHaveTitle(seededGroupTitlePattern(fixture.groupName), uiTimeout)
      await expectGroupDetailAboutLoaded(page, uiTimeout)
      await expectUnauthenticatedAboutJoinGate(page, fixture.groupName, uiTimeout)
    })

    if (fixture.requiresLoginWithoutLink) {
      test(`GET /groups/:slug/about without invite sends guest to login for ${fixture.label}`, async ({ page }) => {
        await page.goto(`/groups/${fixture.slug}/about`, gotoOpts)
        await waitPastRootSessionLoading(page)
        await expect(page).toHaveURL(/\/login/, routeTimeout)
      })
    } else {
      test(`GET /groups/:slug/about without invite shows signup gate for ${fixture.label}`, async ({ page }) => {
        await page.goto(`/groups/${fixture.slug}/about`, gotoOpts)
        await waitPastRootSessionLoading(page)
        await expect(page).toHaveURL(new RegExp(`/groups/${fixture.slug}/about`), routeTimeout)
        await expect(page).toHaveTitle(seededGroupTitlePattern(fixture.groupName), uiTimeout)
        await expectGroupDetailAboutLoaded(page, uiTimeout)
        await expectUnauthenticatedAboutJoinGate(page, fixture.groupName, uiTimeout)
      })
    }
  }
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
