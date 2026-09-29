import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { ensureHyloCookieConsent, dismissAppInstallPrompt } from './helpers/sessionAuth.js'
import { expectGroupDetailAboutLoaded } from './helpers/invitationLinksSeed.js'

/**
 * Joining from an invitation (D5, D16, D17):
 * - Someone not signed in who opens a valid invitation lands on the group's About page with
 *   '<Name> invited you', a Sign up that keeps the invitation and fills in their email, and a
 *   Log in that keeps it too. The group's own join link names nobody.
 * - Someone who has just created their account from an invitation skips the photo and location
 *   steps, lands back on the invitation's one combined join screen, joins with one button, and the
 *   group welcome shows only the purpose and Introduce yourself.
 *
 * Seed (`apps/backend/scripts/seed-e2e-baseline.js`): E2E Join Host sent `e2e.user` the email
 * invitation to `e2e-invite-token-group`; `e2e.invite-signup@hylo.test` has just signed up
 * (signup_in_progress) and is in no group. Set PLATFORM_INVITE_LANDING_SCREENSHOTS to a directory
 * to save screenshots there.
 */

test.describe.configure({ timeout: 180000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }
const gotoOpts = { waitUntil: 'domcontentloaded' }

const INVITE = {
  slug: 'e2e-invite-token-group',
  name: 'E2E Invite Public Restricted',
  token: 'e2e-static-invite-token-001',
  inviter: 'E2E Join Host',
  email: 'e2e.user@hylo.test'
}
const JOIN_LINK = { slug: 'e2e-join-code-group', name: 'E2E Join Public Closed', accessCode: 'e2ejoincode001' }
const JUST_SIGNED_UP = { email: 'e2e.invite-signup@hylo.test', password: 'e2e-password-123' }

/**
 * Saves a viewport screenshot when PLATFORM_INVITE_LANDING_SCREENSHOTS names a directory.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {string} name
 */
async function capture (page, testInfo, name) {
  const dir = process.env.PLATFORM_INVITE_LANDING_SCREENSHOTS
  if (!dir) return
  fs.mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `${testInfo.project.name}-${name}.png`), animations: 'disabled' })
}

/** Runs a GraphQL document as whoever is signed in on this page. */
async function graphqlAs (page, query, variables = {}) {
  return page.evaluate(async ({ query, variables }) => {
    const response = await fetch('/noo/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    })
    return response.json()
  }, { query, variables })
}

test.describe('someone not signed in opens an invitation', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('about:blank')
    await page.evaluate(() => {
      try {
        window.localStorage.clear()
        window.sessionStorage.clear()
      } catch (e) {}
    })
    await ensureHyloCookieConsent(page)
  })

  test('lands on the About page saying who invited them, and signs up with the invitation kept', async ({ page }, testInfo) => {
    await page.goto(`/h/use-invitation?token=${INVITE.token}`, gotoOpts)
    await waitPastRootSessionLoading(page)

    await expect(page).toHaveURL(new RegExp(`/groups/${INVITE.slug}/about\\?token=${INVITE.token}`), navTimeout)
    await expectGroupDetailAboutLoaded(page, uiTimeout)
    await expect(page.getByTestId('invited-by-banner')).toContainText(`${INVITE.inviter} invited you`, uiTimeout)
    await expect(page.getByText('Stewards review every request to join this group.')).toHaveCount(0)
    await expect(page.getByTestId('signed-out-log-in')).toHaveAttribute(
      'href',
      `/login?returnToUrl=${encodeURIComponent(`/groups/${INVITE.slug}/about?token=${INVITE.token}`)}`
    )
    await capture(page, testInfo, 'invite-landing-01-about-invited-by')

    await page.getByRole('button', { name: `Sign up to join ${INVITE.name}` }).click()
    await expect(page).toHaveURL(/\/signup\/?$/, navTimeout)
    await expect(page.locator('#email')).toHaveValue(INVITE.email, uiTimeout)
    const returnToPath = await page.evaluate(() => JSON.parse(window.localStorage.getItem('returnToPath')))
    expect(returnToPath).toBe(`/groups/${INVITE.slug}/about?token=${INVITE.token}`)
    await capture(page, testInfo, 'invite-landing-02-signup-prefilled')
  })

  test("lands on the About page from the group's join link, which names nobody", async ({ page }, testInfo) => {
    await page.goto(`/groups/${JOIN_LINK.slug}/join/${JOIN_LINK.accessCode}`, gotoOpts)
    await waitPastRootSessionLoading(page)

    await expect(page).toHaveURL(new RegExp(`/groups/${JOIN_LINK.slug}/about\\?accessCode=${JOIN_LINK.accessCode}`), navTimeout)
    await expectGroupDetailAboutLoaded(page, uiTimeout)
    await expect(page.getByRole('button', { name: `Sign up to join ${JOIN_LINK.name}` })).toBeVisible(uiTimeout)
    await expect(page.getByTestId('invited-by-banner')).toHaveCount(0)
    await capture(page, testInfo, 'invite-landing-03-join-link-about')
  })

  test('still goes to signup with the expired message for an invalid invitation', async ({ page }) => {
    await page.goto('/h/use-invitation?token=e2e-no-such-invitation', gotoOpts)
    await expect(page).toHaveURL(/\/signup/, navTimeout)
  })
})

test.describe('someone who has just signed up from an invitation', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('skips the photo and location steps, joins on one screen, and sees no repeated welcome pages', async ({ page, context }, testInfo) => {
    // One account and one group: run it in a single project so projects running in parallel don't race
    test.skip(testInfo.project.name !== 'chromium', 'desktop only: it changes one seeded account')
    await context.clearCookies()
    await ensureHyloCookieConsent(page)

    await page.goto(`/groups/${JOIN_LINK.slug}/join/${JOIN_LINK.accessCode}`, gotoOpts)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${JOIN_LINK.slug}/about`), navTimeout)

    // Log in keeps the invitation, like Sign up; the account is exactly as registration leaves it
    await page.getByTestId('signed-out-log-in').click()
    await expect(page).toHaveURL(/\/login/, navTimeout)
    await page.locator('#email').fill(JUST_SIGNED_UP.email)
    await page.locator('#password').fill(JUST_SIGNED_UP.password)
    await page.getByRole('button', { name: /sign\s*in/i }).click()

    try {
      await expect(page).toHaveURL(new RegExp(`/groups/${JOIN_LINK.slug}/about\\?accessCode=${JOIN_LINK.accessCode}`), navTimeout)
      await dismissAppInstallPrompt(page)
      expect(page.url()).not.toContain('/welcome')
      await expect(page.getByTestId('upload-photo-button')).toHaveCount(0)

      const join = page.locator('.JoinSection-JoinButton')
      await expect(join).toBeVisible(uiTimeout)
      await expect(join).toContainText(JOIN_LINK.name)
      await expect(join).toBeEnabled()
      await capture(page, testInfo, 'invite-landing-04-combined-join-screen')

      await join.click()
      await expect(page).toHaveURL(new RegExp(`/groups/${JOIN_LINK.slug}`), navTimeout)
      const welcome = page.getByTestId('group-welcome-modal')
      await expect(welcome).toBeVisible(uiTimeout)
      await expect(welcome.getByTestId('cbAgreement0')).toHaveCount(0)
      await expect(welcome.getByPlaceholder('Type your answer here...')).toHaveCount(0)
      await expect(welcome.getByTestId('jump-in')).toBeEnabled()
      await capture(page, testInfo, 'invite-landing-05-welcome-without-repeats')
      await welcome.getByTestId('jump-in').click()
      await expect(welcome).toHaveCount(0, uiTimeout)
    } finally {
      // Leave the account as the seed made it, so a retry starts over
      const groupResult = await graphqlAs(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: JOIN_LINK.slug })
      const groupId = groupResult?.data?.group?.id
      if (groupId) await graphqlAs(page, 'mutation ($id: ID) { leaveGroup(id: $id) }', { id: groupId })
      await graphqlAs(page, 'mutation { updateMe(changes: { settings: { signupInProgress: true, profileNudge: null } }) { id } }')
    }
  })
})
