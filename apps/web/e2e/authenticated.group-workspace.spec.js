import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch D — group workspace `/groups/:slug/*` (member-facing views).
 * Uses seeded groups from `scripts/seed-e2e-baseline.js`: `e2e-public-group`, `e2e-private-group`.
 *
 * Skipped here (other batches / needs IDs): `custom/:customViewId` (Batch J), inner `*` default redirect covered via bogus segment test.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

const PUBLIC_GROUP_SLUG = 'e2e-public-group'
const PRIVATE_GROUP_SLUG = 'e2e-private-group'

/** Path under the seeded public group (`/groups/e2e-public-group` + rest). */
function groupPublic (rest) {
  const r = rest.startsWith('/') ? rest : `/${rest}`
  return `/groups/${PUBLIC_GROUP_SLUG}${r}`
}

/** Path under the seeded private group. */
function groupPrivate (rest) {
  const r = rest.startsWith('/') ? rest : `/${rest}`
  return `/groups/${PRIVATE_GROUP_SLUG}${r}`
}

async function expectGroupWorkspaceShell (page, urlPattern) {
  await expect(page).toHaveURL(urlPattern, navTimeout)
  await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
  await expect(page).toHaveTitle(/E2E|Hylo/i, uiTimeout)
}

test.describe('Batch D: group workspace', () => {
  test('GET …/stream redirects to group all view', async ({ page }) => {
    await page.goto(groupPublic('/stream'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/all`))
  })

  test('GET …/all loads group all view', async ({ page }) => {
    await page.goto(groupPublic('/all'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/all`))
  })

  test('GET …/about loads group about', async ({ page }) => {
    await page.goto(groupPublic('/about'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/about`))
  })

  test('GET …/map loads group map', async ({ page }) => {
    await page.goto(groupPublic('/map'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/map`))
  })

  test('GET …/discussions loads discussions stream', async ({ page }) => {
    await page.goto(groupPublic('/discussions'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/discussions`))
  })

  test('GET …/events loads events stream', async ({ page }) => {
    await page.goto(groupPublic('/events'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/events`))
  })

  test('GET …/resources loads resources stream', async ({ page }) => {
    await page.goto(groupPublic('/resources'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/resources`))
  })

  test('GET …/projects loads projects stream', async ({ page }) => {
    await page.goto(groupPublic('/projects'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/projects`))
  })

  test('GET …/proposals loads proposals stream', async ({ page }) => {
    await page.goto(groupPublic('/proposals'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/proposals`))
  })

  test('GET …/requests-and-offers loads R&O stream', async ({ page }) => {
    await page.goto(groupPublic('/requests-and-offers'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/requests-and-offers`))
  })

  test('GET …/explore loads landing explorer', async ({ page }) => {
    await page.goto(groupPublic('/explore'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/explore`))
  })

  test('GET …/topics loads group topics directory', async ({ page }) => {
    await page.goto(groupPublic('/topics'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/topics$`))
  })

  test('GET …/topics/:topicName loads topic stream', async ({ page }) => {
    await page.goto(groupPublic('/topics/e2e-smoke-topic'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/topics/e2e-smoke-topic`))
  })

  test('GET …/members loads members list', async ({ page }) => {
    await page.goto(groupPublic('/members'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/members`))
  })

  test('GET …/groups redirects to about/related-groups', async ({ page }) => {
    await page.goto(groupPublic('/groups'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/about/related-groups`))
  })

  test('GET …/all-views redirects to more-spaces', async ({ page }) => {
    await page.goto(groupPublic('/all-views'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/more-spaces`))
  })

  test('GET …/tracks redirects to more-spaces', async ({ page }) => {
    await page.goto(groupPublic('/tracks'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/more-spaces`))
  })

  test('GET …/funding-rounds redirects to more-spaces', async ({ page }) => {
    await page.goto(groupPublic('/funding-rounds'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/more-spaces`))
  })

  test('GET …/all-topics redirects to more-spaces', async ({ page }) => {
    await page.goto(groupPublic('/all-topics'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/more-spaces`))
  })

  test('GET …/chat opens chat room', async ({ page }) => {
    await page.goto(groupPublic('/chat'))
    await waitPastRootSessionLoading(page)
    await expectGroupWorkspaceShell(page, new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/chat/?$`))
  })

  test('GET …/settings opens group settings', async ({ page }) => {
    await page.goto(groupPublic('/settings'))
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/settings`), navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page).toHaveTitle(/E2E|Hylo/i, uiTimeout)
  })

  test('GET …/stream on private seeded group redirects to all', async ({ page }) => {
    await page.goto(groupPrivate('/stream'))
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${PRIVATE_GROUP_SLUG}/all`), navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page).toHaveTitle(/E2E|Hylo/i, uiTimeout)
  })

  test('unknown child path redirects away from bogus segment (group home)', async ({ page }) => {
    await page.goto(groupPublic('/e2e-unknown-route-segment'))
    await waitPastRootSessionLoading(page)
    // Catch-all Navigate runs after paint — plain page.url() does not retry
    await expect(page).not.toHaveURL(/e2e-unknown-route-segment/, navTimeout)
    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/`), navTimeout)
  })
})
