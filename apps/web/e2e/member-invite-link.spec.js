import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Members' personal invite links.
 * Seed: `E2E_MEMBER_LINK_GROUPS` in `apps/backend/scripts/seed-e2e-baseline.js`: E2E Member A has a
 * link in each group, `e2e.user` is not in the Open, Restricted or busy one and administers the
 * requests one. The isolated runner turns member invites on (FEATURE_FLAG_MEMBER_INVITES /
 * VITE_FEATURE_FLAG_MEMBER_INVITES). Set PLATFORM_MEMBER_LINK_SCREENSHOTS to a directory to save
 * screenshots there.
 */

test.describe.configure({ timeout: 180000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

/** `e2e.user` is a plain member; everyone can invite */
const EVERYONE_GROUP = { slug: 'e2e-member-invites' }
const OPEN_GROUP = { slug: 'e2e-member-link-open', name: 'E2E Member Link Open', code: 'e2eMemberLinkOpen01' }
const RESTRICTED_GROUP = { slug: 'e2e-member-link-restricted', name: 'E2E Member Link Restricted', code: 'e2eMemberLinkRestr1' }
const BUSY_GROUP = { slug: 'e2e-member-link-busy', code: 'e2eMemberLinkBusy01' }
const REQUESTS_GROUP = { slug: 'e2e-member-link-requests' }
const SPONSOR_NAME = 'E2E Member A'
const LINK_INVITEE_NAME = 'E2E Link Invitee'

/**
 * Saves a viewport screenshot (after scrolling `focus` into view) when
 * PLATFORM_MEMBER_LINK_SCREENSHOTS names a directory.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {string} name
 * @param {import('@playwright/test').Locator} [focus]
 */
async function capture (page, testInfo, name, focus) {
  const dir = process.env.PLATFORM_MEMBER_LINK_SCREENSHOTS
  if (!dir) return
  if (focus) await focus.scrollIntoViewIfNeeded()
  fs.mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `${testInfo.project.name}-${name}.png`), animations: 'disabled' })
}

test.describe('A member shares their personal invite link', () => {
  test('makes the link in the Invite dialog and copies it', async ({ page, context }, testInfo) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    await page.goto(`/groups/${EVERYONE_GROUP.slug}/members`)
    await waitPastRootSessionLoading(page)
    await page.locator('#center-column').getByRole('button', { name: 'Invite Members' }).click()

    const dialog = page.getByRole('dialog', { name: 'Invite People' })
    const card = dialog.getByTestId('member-invite-link-card')
    await expect(card).toBeVisible(uiTimeout)
    await expect(card.getByText('Your personal invite link')).toBeVisible()
    await expect(dialog.getByText('Share a Join Link')).toHaveCount(0)

    const create = card.getByRole('button', { name: 'Create my invite link' })
    // A retry finds the link made by the first try
    if (await create.isVisible()) await create.click()
    const link = card.getByText(new RegExp(`/groups/${EVERYONE_GROUP.slug}/join/[A-Za-z0-9]{16}`))
    await expect(link).toBeVisible(uiTimeout)
    await expect(card.getByRole('button', { name: 'Reset Link' })).toBeVisible()
    await capture(page, testInfo, 'member-link-01-card', card)

    await card.getByText('Copy', { exact: true }).click()
    await expect(card.getByText('Copied!')).toBeVisible(uiTimeout)
  })
})

test.describe('Following a member\'s personal invite link', () => {
  test('joins an Open group, crediting the member', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'joins one seeded group')

    await page.goto(`/groups/${OPEN_GROUP.slug}/join/${OPEN_GROUP.code}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${OPEN_GROUP.slug}`), navTimeout)

    const join = page.getByRole('button', { name: `Join ${OPEN_GROUP.name}` })
    const member = page.getByText(/You are a member of/)
    await expect(join.or(member).first()).toBeVisible(uiTimeout)
    // A retry after joining finds the person already in
    if (await join.isVisible()) {
      await capture(page, testInfo, 'member-link-02-open-join', join)
      await join.click()
      await expect(page).toHaveURL(new RegExp(`/groups/${OPEN_GROUP.slug}(?!/about)`), navTimeout)
    }
  })

  test('asks to join a Restricted group, showing who invited the person', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'uses one seeded group')

    await page.goto(`/groups/${RESTRICTED_GROUP.slug}/join/${RESTRICTED_GROUP.code}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${RESTRICTED_GROUP.slug}/about\\?accessCode=${RESTRICTED_GROUP.code}`), navTimeout)

    const request = page.getByRole('button', { name: `Request Membership in ${RESTRICTED_GROUP.name}` })
    const pending = page.getByText('Request to join pending')
    await expect(request.or(pending)).toBeVisible(uiTimeout)
    // A retry after the request was sent finds it pending
    if (await request.isVisible()) {
      await expect(page.getByText(`${SPONSOR_NAME} invited you`)).toBeVisible()
      await expect(page.getByRole('button', { name: `Join ${RESTRICTED_GROUP.name}` })).toHaveCount(0)
      await capture(page, testInfo, 'member-link-03-restricted-request', request)
      await request.click()
    }
    await expect(pending).toBeVisible(uiTimeout)
  })

  test('says to try again later once the link has been used as often as it can be today', async ({ page }, testInfo) => {
    await page.goto(`/groups/${BUSY_GROUP.slug}/join/${BUSY_GROUP.code}`)
    await waitPastRootSessionLoading(page)

    const message = page.getByTestId('invite-try-later')
    await expect(message).toBeVisible(uiTimeout)
    await expect(message.getByText("This invite link can't be used right now")).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/groups/${BUSY_GROUP.slug}/join/${BUSY_GROUP.code}`))
    await capture(page, testInfo, 'member-link-04-try-later', message)
  })
})

test.describe('Approving people who came through a member\'s link', () => {
  test('an administrator sees who invited the requester', async ({ page }, testInfo) => {
    await page.goto(`/groups/${REQUESTS_GROUP.slug}/settings/requests`)
    await waitPastRootSessionLoading(page)

    await expect(page.getByText(LINK_INVITEE_NAME, { exact: true })).toBeVisible(uiTimeout)
    const invitedBy = page.getByText(`Invited by ${SPONSOR_NAME}`)
    await expect(invitedBy).toBeVisible(uiTimeout)
    await capture(page, testInfo, 'member-link-05-request-invited-by', invitedBy)
  })
})
