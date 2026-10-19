import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Issue #1599 — hovering (desktop) or long-pressing (mobile web) a person's avatar opens a
 * profile hover card. The Message button only appears for people the viewer could pick in the
 * new-message recipient search (`Person.canMessage`).
 *
 * Seed (`scripts/seed-e2e-baseline.js`): posts in `e2e-public-group` are by the E2E user, who is
 * its Administrator. `e2e.member-a` shares that group, so can message the E2E user. The join host
 * shares no group with the E2E user; the test makes the host's profile public and has them publish
 * a public post, so the E2E user can see the host but not message them.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const STREAM_PATH = '/groups/e2e-public-group/stream'
const PASSWORD = 'e2e-password-123'
const MEMBER_A_EMAIL = 'e2e.member-a@hylo.test'
const HOST_EMAIL = 'e2e.join-host@hylo.test'
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

/** Must match `playwright.config.js` — manual `browser.newContext()` does not inherit `use.baseURL`. */
function baseUrl () {
  return `http://localhost:${process.env.E2E_WEB_PORT || process.env.PORT || '3000'}`
}

async function graphql (request, query, variables = {}) {
  const res = await request.post('/noo/graphql', { data: { query, variables } })
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  expect(json.errors, JSON.stringify(json.errors)).toBeUndefined()
  return json.data
}

/** A fresh context signed in as `email` through the API (no UI login). */
async function contextFor (browser, email) {
  const context = await browser.newContext({ baseURL: baseUrl(), storageState: { cookies: [], origins: [] } })
  const data = await graphql(context.request,
    'mutation ($email: String, $password: String) { login(email: $email, password: $password) { error me { id } } }',
    { email, password: PASSWORD })
  expect(data.login.error).toBeFalsy()
  return context
}

async function firstAvatarIn (page, urlPath) {
  await page.goto(urlPath)
  await waitPastRootSessionLoading(page)
  const avatar = page.locator('#center-column [data-profile-hover-card-trigger]').first()
  await expect(avatar).toBeVisible(uiTimeout)
  return avatar
}

async function expectCard (page, { name, role, message }) {
  const card = page.getByTestId('profile-hover-card')
  await expect(card).toBeVisible(uiTimeout)
  await expect(card.getByText(name)).toBeVisible(uiTimeout)
  if (role) await expect(card.getByTestId('profile-card-roles')).toContainText(role, uiTimeout)
  await expect(card.getByRole('button', { name: 'View Profile' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Message' })).toHaveCount(message ? 1 : 0, uiTimeout)
  return card
}

function saveScreenshot (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  return page.screenshot({ path: path.resolve(screenshotDir, name) })
}

test.describe('Profile hover card', () => {
  test('opens on hover over a feed avatar and closes on Escape (own card: no Message)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover is desktop-only; see the long-press test')
    const avatar = await firstAvatarIn(page, STREAM_PATH)
    await avatar.hover()
    await expectCard(page, { name: 'E2E User', role: 'Administrator', message: false })

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('profile-hover-card')).toHaveCount(0)
  })

  test('shows Message for a fellow group member, and links to the profile', async ({ browser, isMobile }) => {
    test.skip(isMobile, 'hover is desktop-only')
    const context = await contextFor(browser, MEMBER_A_EMAIL)
    try {
      const page = await context.newPage()
      const avatar = await firstAvatarIn(page, STREAM_PATH)
      await avatar.hover()
      const card = await expectCard(page, { name: 'E2E User', role: 'Administrator', message: true })
      await saveScreenshot(page, 'issue-1599-desktop-can-message.png')
      await card.getByRole('button', { name: 'View Profile' }).click()
      await expect(page).toHaveURL(/\/members\/1/, uiTimeout)
    } finally {
      await context.close()
    }
  })

  test('hides Message for someone visible but outside the recipient search', async ({ browser, page, isMobile }) => {
    test.skip(isMobile, 'hover is desktop-only')
    const hostContext = await contextFor(browser, HOST_EMAIL)
    let postId
    try {
      const { me } = await graphql(hostContext.request, '{ me { id memberships { group { id slug } } } }')
      const group = me.memberships.map(m => m.group).find(g => g.slug === 'e2e-nomember-a')
      expect(group).toBeTruthy()
      await graphql(hostContext.request, 'mutation { updateMe(changes: { isProfilePublic: true }) { id } }')
      const created = await graphql(hostContext.request,
        'mutation ($data: PostInput) { createPost(data: $data) { id } }',
        { data: { type: 'discussion', title: 'E2E Hover Card Host Post', details: '<p>Public post by the join host</p>', groupIds: [group.id], isPublic: true } })
      postId = created.createPost.id
    } finally {
      await hostContext.close()
    }

    const avatar = await firstAvatarIn(page, `/post/${postId}`)
    await avatar.hover()
    await expectCard(page, { name: 'E2E Join Host', message: false })
    await saveScreenshot(page, 'issue-1599-desktop-cannot-message.png')
  })

  test('opens on long press without following the avatar link', async ({ page, isMobile, browserName }) => {
    test.skip(!isMobile || browserName !== 'chromium', 'long press is checked on the mobile-chrome project')
    const avatar = await firstAvatarIn(page, STREAM_PATH)
    const box = await avatar.boundingBox()
    const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), id: 1 }
    const startUrl = page.url()

    // Playwright has no long-press gesture; drive raw touch events through CDP
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    await page.waitForTimeout(800)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    await expectCard(page, { name: 'E2E User', role: 'Administrator', message: false })
    expect(page.url()).toBe(startUrl)
    await saveScreenshot(page, 'issue-1599-mobile-long-press.png')

    // Tapping outside closes it
    await page.touchscreen.tap(10, Math.round((page.viewportSize().height) - 40))
    await expect(page.getByTestId('profile-hover-card')).toHaveCount(0, uiTimeout)
  })
})
