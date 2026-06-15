import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import {
  HIDDEN_JOIN_ACCESS_CODE,
  HIDDEN_JOIN_GROUP_SLUG,
  JOIN_ACCESS_CODE,
  JOIN_CODE_GROUP_SLUG,
  INVITE_TOKEN,
  INVITE_TOKEN_GROUP_SLUG,
  expectGroupDetailAboutLoaded,
  seededGroupTitlePattern
} from './helpers/invitationLinksSeed.js'

/**
 * Batch Q — invitation / join links → `/groups/:slug/about` with `accessCode` or `token`
 * (`INVITATION_LINKS_ARCHITECTURE.md`, post–paid-content redirect flow).
 * Seeded data: `seed-e2e-baseline.js`.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }
const gotoOpts = { waitUntil: 'domcontentloaded' }

test.describe('Batch Q: invitation → about (authenticated)', () => {
  test.beforeEach(({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())
  })

  test('GET /groups/:slug/join/:accessCode redirects to /about?accessCode=', async ({ page }) => {
    await page.goto(`/groups/${JOIN_CODE_GROUP_SLUG}/join/${JOIN_ACCESS_CODE}`, gotoOpts)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${JOIN_CODE_GROUP_SLUG}/about\\?accessCode=${JOIN_ACCESS_CODE}`),
      navTimeout
    )
    await expect(page).toHaveTitle(seededGroupTitlePattern('E2E Join Code Group'), uiTimeout)
    await expect(page.locator('.JoinSection')).toBeVisible(uiTimeout)
  })

  test('GET /h/use-invitation?token= redirects to /about?token=', async ({ page }) => {
    await page.goto(`/h/use-invitation?token=${encodeURIComponent(INVITE_TOKEN)}`, gotoOpts)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${INVITE_TOKEN_GROUP_SLUG}/about\\?token=${INVITE_TOKEN}`),
      navTimeout
    )
    await expect(page).toHaveTitle(seededGroupTitlePattern('E2E Invite Token Group'), uiTimeout)
    await expect(page.locator('.JoinSection')).toBeVisible(uiTimeout)
  })

  test('GET /groups/:slug/about?accessCode= loads join surface (deep link)', async ({ page }) => {
    await page.goto(
      `/groups/${JOIN_CODE_GROUP_SLUG}/about?accessCode=${encodeURIComponent(JOIN_ACCESS_CODE)}`,
      gotoOpts
    )
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${JOIN_CODE_GROUP_SLUG}/about`),
      navTimeout
    )
    await expect(page).toHaveTitle(seededGroupTitlePattern('E2E Join Code Group'), uiTimeout)
    await expect(page.locator('.JoinSection')).toBeVisible(uiTimeout)
  })

  test('GET /groups/:slug/join/:accessCode for hidden group redirects to /about?accessCode=', async ({ page }) => {
    await page.goto(
      `/groups/${HIDDEN_JOIN_GROUP_SLUG}/join/${HIDDEN_JOIN_ACCESS_CODE}`,
      gotoOpts
    )
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(
        `/groups/${HIDDEN_JOIN_GROUP_SLUG}/about\\?accessCode=${HIDDEN_JOIN_ACCESS_CODE}`
      ),
      navTimeout
    )
    await expectGroupDetailAboutLoaded(page, uiTimeout)
    await expect(page).toHaveTitle(seededGroupTitlePattern('E2E Hidden Join Group'), uiTimeout)
    await expect(page.locator('.JoinSection')).toBeVisible(uiTimeout)
  })

  test('GET /groups/:slug/about?accessCode= grants join surface for hidden group (deep link)', async ({ page }) => {
    await page.goto(
      `/groups/${HIDDEN_JOIN_GROUP_SLUG}/about?accessCode=${encodeURIComponent(HIDDEN_JOIN_ACCESS_CODE)}`,
      gotoOpts
    )
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${HIDDEN_JOIN_GROUP_SLUG}/about`), navTimeout)
    await expectGroupDetailAboutLoaded(page, uiTimeout)
    await expect(page).toHaveTitle(seededGroupTitlePattern('E2E Hidden Join Group'), uiTimeout)
    await expect(page.locator('.JoinSection')).toBeVisible(uiTimeout)
  })
})
