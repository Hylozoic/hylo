import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import {
  JOIN_LINK_FIXTURES,
  INVITE_LINK_FIXTURES,
  expectAuthenticatedJoinLinkButton,
  expectGroupDetailAboutLoaded,
  expectNoJoinButton,
  seededGroupTitlePattern
} from './helpers/invitationLinksSeed.js'

/**
 * Batch Q — invitation / join links → `/groups/:slug/about` with `accessCode` or `token`
 * (`INVITATION_LINKS_ARCHITECTURE.md`, post–paid-content redirect flow).
 * Seeded data: `seed-e2e-baseline.js` — all visibility × accessibility combos except Open.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }
const gotoOpts = { waitUntil: 'domcontentloaded' }

test.describe('Batch Q: join links → about (authenticated)', () => {
  test.beforeEach(({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())
  })

  for (const fixture of JOIN_LINK_FIXTURES) {
    test(`GET /groups/:slug/join/:accessCode redirects for ${fixture.label}`, async ({ page }) => {
      await page.goto(`/groups/${fixture.slug}/join/${fixture.accessCode}`, gotoOpts)
      await waitPastRootSessionLoading(page)
      await expect(page).toHaveURL(
        new RegExp(`/groups/${fixture.slug}/about\\?accessCode=${fixture.accessCode}`),
        navTimeout
      )
      await expect(page).toHaveTitle(seededGroupTitlePattern(fixture.groupName), uiTimeout)
      await expect(page.locator('.JoinSection')).toBeVisible(uiTimeout)
      await expectAuthenticatedJoinLinkButton(page, fixture.groupName, uiTimeout)
    })

    test(`GET /groups/:slug/about?accessCode= deep link for ${fixture.label}`, async ({ page }) => {
      await page.goto(
        `/groups/${fixture.slug}/about?accessCode=${encodeURIComponent(fixture.accessCode)}`,
        gotoOpts
      )
      await waitPastRootSessionLoading(page)
      await expect(page).toHaveURL(new RegExp(`/groups/${fixture.slug}/about`), navTimeout)
      await expectGroupDetailAboutLoaded(page, uiTimeout)
      await expect(page).toHaveTitle(seededGroupTitlePattern(fixture.groupName), uiTimeout)
      await expectAuthenticatedJoinLinkButton(page, fixture.groupName, uiTimeout)
    })
  }

  for (const fixture of JOIN_LINK_FIXTURES.filter((f) => !f.requiresLoginWithoutLink && f.accessibility === 'closed')) {
    test(`GET /groups/:slug/about without join link shows no join CTA for ${fixture.label}`, async ({ page }) => {
      await page.goto(`/groups/${fixture.slug}/about`, gotoOpts)
      await waitPastRootSessionLoading(page)
      await expect(page).toHaveURL(new RegExp(`/groups/${fixture.slug}/about`), navTimeout)
      await expectGroupDetailAboutLoaded(page, uiTimeout)
      await expect(page).toHaveTitle(seededGroupTitlePattern(fixture.groupName), uiTimeout)
      await expectNoJoinButton(page, uiTimeout)
    })
  }
})

test.describe('Batch Q: invite links → about (authenticated)', () => {
  test.beforeEach(({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())
  })

  for (const fixture of INVITE_LINK_FIXTURES) {
    test(`GET /h/use-invitation?token= redirects for ${fixture.label}`, async ({ page }) => {
      await page.goto(`/h/use-invitation?token=${encodeURIComponent(fixture.token)}`, gotoOpts)
      await waitPastRootSessionLoading(page)
      await expect(page).toHaveURL(
        new RegExp(`/groups/${fixture.slug}/about\\?token=${fixture.token}`),
        navTimeout
      )
      await expect(page).toHaveTitle(seededGroupTitlePattern(fixture.groupName), uiTimeout)
      await expect(page.locator('.JoinSection')).toBeVisible(uiTimeout)
      await expectAuthenticatedJoinLinkButton(page, fixture.groupName, uiTimeout)
    })

    test(`GET /groups/:slug/about?token= deep link for ${fixture.label}`, async ({ page }) => {
      await page.goto(
        `/groups/${fixture.slug}/about?token=${encodeURIComponent(fixture.token)}`,
        gotoOpts
      )
      await waitPastRootSessionLoading(page)
      await expect(page).toHaveURL(new RegExp(`/groups/${fixture.slug}/about`), navTimeout)
      await expectGroupDetailAboutLoaded(page, uiTimeout)
      await expect(page).toHaveTitle(seededGroupTitlePattern(fixture.groupName), uiTimeout)
      await expectAuthenticatedJoinLinkButton(page, fixture.groupName, uiTimeout)
    })
  }

  for (const fixture of INVITE_LINK_FIXTURES.filter((f) => !f.requiresLoginWithoutLink && f.accessibility === 'closed')) {
    test(`GET /groups/:slug/about without invite shows no join CTA for ${fixture.label}`, async ({ page }) => {
      await page.goto(`/groups/${fixture.slug}/about`, gotoOpts)
      await waitPastRootSessionLoading(page)
      await expect(page).toHaveURL(new RegExp(`/groups/${fixture.slug}/about`), navTimeout)
      await expectGroupDetailAboutLoaded(page, uiTimeout)
      await expect(page).toHaveTitle(seededGroupTitlePattern(fixture.groupName), uiTimeout)
      await expectNoJoinButton(page, uiTimeout)
    })
  }
})
