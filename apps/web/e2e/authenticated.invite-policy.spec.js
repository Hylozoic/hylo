import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * "Who can add new members?" and invitations sent by members.
 * Seed: `E2E_MEMBER_INVITE_GROUPS` in `apps/backend/scripts/seed-e2e-baseline.js`. The isolated
 * runner turns member invites on (FEATURE_FLAG_MEMBER_INVITES / VITE_FEATURE_FLAG_MEMBER_INVITES).
 * Set PLATFORM_INVITE_POLICY_SCREENSHOTS to a directory to save screenshots there.
 */

test.describe.configure({ timeout: 180000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

/** `e2e.user` is a plain member; everyone can invite */
const EVERYONE_GROUP = { slug: 'e2e-member-invites' }
/** `e2e.user` is a plain member; only stewards can invite */
const STEWARDS_GROUP = { slug: 'e2e-steward-invites' }
/** E2E Member A invited `e2e.user` here */
const LANDING_GROUP = { slug: 'e2e-member-invite-landing', name: 'E2E Member Invite Landing', token: 'e2e-member-invite-landing-001' }
/** `e2e.user` administers it; E2E Member A's invitee is waiting for approval */
const REQUESTS_GROUP = { slug: 'e2e-member-invite-requests' }
const INVITEE_NAME = 'E2E Invitee'
const GROUP_ADMINISTRATOR_NAME = 'E2E Join Host'

const WHO_CAN_ADD = 'Who can add new members?'
const STEWARDS_ONLY = 'Stewards with the Add Members responsibility'
const EVERYONE = 'Everyone in the Group'

/**
 * Saves a viewport screenshot (after scrolling `focus` into view) when
 * PLATFORM_INVITE_POLICY_SCREENSHOTS names a directory.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {string} name
 * @param {import('@playwright/test').Locator} [focus]
 */
async function capture (page, testInfo, name, focus) {
  const dir = process.env.PLATFORM_INVITE_POLICY_SCREENSHOTS
  if (!dir) return
  if (focus) await focus.scrollIntoViewIfNeeded()
  fs.mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `${testInfo.project.name}-${name}.png`) })
}

/**
 * Waits for the Roles & Badges invite-policy save to reach the API.
 * @param {import('@playwright/test').Page} page
 */
function waitForSettingsSave (page) {
  return page.waitForResponse(response =>
    response.url().includes('/noo/graphql') &&
    (response.request().postData() || '').includes('updateGroupSettings'), navTimeout)
}

test.describe('Who can add new members? (administrator)', () => {
  test('is chosen when creating a group and changed in Roles & Badges', async ({ page }, testInfo) => {
    const device = testInfo.project.name.includes('mobile') ? 'mobile' : 'desktop'
    const name = `Invite Policy ${device} ${Date.now().toString(36)}`

    await page.goto('/public/all?create=group')
    await expect(page.locator('#center-column-container')).toBeVisible(uiTimeout)
    const createDialog = page.getByRole('dialog', { name: 'Create a group' })
    await expect(createDialog).toBeVisible(uiTimeout)
    await createDialog.locator('#groupName').fill(name)

    const createPolicy = createDialog.getByRole('button', { name: WHO_CAN_ADD })
    await expect(createPolicy).toContainText(STEWARDS_ONLY)
    await createPolicy.click()
    await page.getByRole('button', { name: EVERYONE }).click()
    await expect(createPolicy).toContainText(EVERYONE)
    await capture(page, testInfo, 'invite-policy-01-create-everyone', createPolicy)

    const slug = await createDialog.locator('#groupSlug').inputValue()
    expect(slug).toBeTruthy()
    const submit = createDialog.getByRole('button', { name: /Create Group/i })
    await expect(submit).toBeEnabled(uiTimeout)
    await submit.click()
    await expect(page).toHaveURL(new RegExp(`/groups/${slug}([/?#]|$)`), navTimeout)

    await page.goto(`/groups/${slug}/settings/roles`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('heading', { name: WHO_CAN_ADD })).toBeVisible(uiTimeout)
    const settingsPolicy = page.getByRole('button', { name: WHO_CAN_ADD })
    await expect(settingsPolicy).toContainText(EVERYONE, uiTimeout)
    await capture(page, testInfo, 'invite-policy-02-settings-everyone', settingsPolicy)

    await settingsPolicy.click()
    const saved = waitForSettingsSave(page)
    await page.getByRole('button', { name: STEWARDS_ONLY }).click()
    await expect(settingsPolicy).toContainText(STEWARDS_ONLY)
    expect((await saved).ok()).toBe(true)

    await page.reload()
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('button', { name: WHO_CAN_ADD })).toContainText(STEWARDS_ONLY, uiTimeout)
    await capture(page, testInfo, 'invite-policy-03-settings-stewards', page.getByRole('button', { name: WHO_CAN_ADD }))
  })
})

/**
 * The Invite pill in the Member Directory header. The group menu header has its own
 * Invite pill with the same label, so scope to the center column.
 * @param {import('@playwright/test').Page} page
 */
function memberDirectoryInvite (page) {
  return page.locator('#center-column').getByRole('button', { name: 'Invite Members' })
}

test.describe('Invitations from members (plain member)', () => {
  test('the Invite button shows only where members can invite', async ({ page }) => {
    await page.goto(`/groups/${STEWARDS_GROUP.slug}/members`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByTestId('member-card').filter({ hasText: GROUP_ADMINISTRATOR_NAME })).toBeVisible(uiTimeout)
    await expect(page.getByRole('button', { name: 'Invite Members' })).toHaveCount(0)

    await page.goto(`/groups/${EVERYONE_GROUP.slug}/members`)
    await waitPastRootSessionLoading(page)
    await expect(memberDirectoryInvite(page)).toBeVisible(uiTimeout)
  })

  test('a member sends a personal email invitation', async ({ page }, testInfo) => {
    const address = `e2e.friend+${testInfo.project.name}-${Date.now().toString(36)}@hylo.test`

    await page.goto(`/groups/${EVERYONE_GROUP.slug}/members`)
    await waitPastRootSessionLoading(page)
    await memberDirectoryInvite(page).click()

    const dialog = page.getByRole('dialog', { name: 'Invite People' })
    await expect(dialog).toBeVisible(uiTimeout)
    await expect(dialog.getByText('Send Invites via email')).toBeVisible(uiTimeout)
    await expect(dialog.getByText('Invite people on Hylo')).toBeVisible(uiTimeout)
    await expect(dialog.getByText(/Invites left today: \d+/)).toBeVisible(uiTimeout)
    await expect(dialog.getByText('Assign a role to invitees (optional):')).toHaveCount(0)
    await capture(page, testInfo, 'invite-policy-05-member-invite-dialog')

    await dialog.getByPlaceholder(/example@domain\.com/).fill(address)
    await dialog.getByRole('button', { name: 'Send Invite' }).click()

    await expect(dialog.getByText('Sent 1 invite')).toBeVisible(uiTimeout)
    await expect(dialog.getByText('Pending Invites')).toBeVisible(uiTimeout)
    await expect(dialog.getByText(address)).toBeVisible(uiTimeout)
    await capture(page, testInfo, 'invite-policy-06-member-invite-sent', dialog.getByText(address))
  })
})

test.describe('Approving people invited by members', () => {
  test('someone invited by a member asks to join', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'uses one seeded invitation')

    await page.goto(`/h/invitation?token=${LANDING_GROUP.token}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${LANDING_GROUP.slug}/about\\?token=${LANDING_GROUP.token}`), navTimeout)

    const join = page.getByRole('button', { name: `Join ${LANDING_GROUP.name}` })
    await expect(join).toBeVisible(uiTimeout)
    await expect(page.getByRole('button', { name: `Request Membership in ${LANDING_GROUP.name}` })).toHaveCount(0)
    await capture(page, testInfo, 'invite-policy-07-email-invite-join', join)
    await join.click()
    await expect(join).toHaveCount(0, uiTimeout)
  })

  test('an administrator sees who invited a requester and welcomes them', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'uses one seeded join request')

    await page.goto(`/groups/${REQUESTS_GROUP.slug}/settings/requests`)
    await waitPastRootSessionLoading(page)

    const invitee = page.getByText(INVITEE_NAME, { exact: true })
    const noRequests = page.getByText('No new join requests')
    await expect(invitee.or(noRequests)).toBeVisible(uiTimeout)
    // A retry after the request was accepted finds none left
    if (await invitee.isVisible()) {
      await capture(page, testInfo, 'invite-policy-09-join-request', invitee)
      await page.getByRole('button', { name: 'Welcome', exact: true }).click()
    }
    await expect(noRequests).toBeVisible(uiTimeout)
  })
})
