import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { ensureHyloCookieConsent } from './helpers/sessionAuth.js'
import { PUBLIC_GROUP_SLUG, JOIN_LINK_FIXTURES, expectGroupDetailAboutLoaded } from './helpers/invitationLinksSeed.js'

/**
 * RootRouter loads the signed-in app, the signed-out pages and the public pages
 * as separate chunks (React.lazy). Each entry page must still load, and an
 * email link's click tags (ctt, cti, ctcn) must be gone from the address once
 * it settles, with the click recorded through recordEmailClick.
 *
 * Runs in the `chromium` and `mobile-chrome` projects: the signed-in check uses
 * their saved session, the signed-out checks start from an empty one.
 */

test.describe.configure({ timeout: 120000 })

const uiTimeout = { timeout: 60000 }
const routeTimeout = { timeout: 60000 }
const gotoOpts = { waitUntil: 'domcontentloaded' }

test.describe('signed-out pages after code-splitting', () => {
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
    page.on('dialog', (dialog) => dialog.accept())
  })

  test('login loads', async ({ page }) => {
    await page.goto('/login')
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('heading', { name: /Sign in to Hylo/i })).toBeVisible(uiTimeout)
    await expect(page.locator('#email')).toBeVisible(uiTimeout)
  })

  test('signup loads', async ({ page }) => {
    await page.goto('/signup')
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('heading', { name: /Welcome to Hylo/i })).toBeVisible(uiTimeout)
  })

  test('an invite link loads', async ({ page }) => {
    const fixture = JOIN_LINK_FIXTURES.find(f => f.visibility === 'public')
    await page.goto(`/groups/${fixture.slug}/join/${fixture.accessCode}`, gotoOpts)
    await waitPastRootSessionLoading(page)
    await expect(page.locator('body')).not.toContainText(/Something went wrong/i, uiTimeout)
    await expect(page.locator('#email, h1, h2').first()).toBeVisible(uiTimeout)
  })

  test('a public post link settles on the post or on login', async ({ page }) => {
    await page.goto('/post/1', gotoOpts)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/post\/1|\/login/, routeTimeout)
    await expect(page.locator('body')).not.toContainText(/Something went wrong/i, uiTimeout)
  })

  test('a public group loads', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/about`, gotoOpts)
    await waitPastRootSessionLoading(page)
    await expectGroupDetailAboutLoaded(page)
  })

  test('an email link records the click and lands without its tags', async ({ page }) => {
    const recorded = page.waitForRequest(request =>
      request.url().includes('/noo/graphql') && (request.postData() || '').includes('RecordEmailClick')
    )
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/about?ctt=digest_email&cti=123&ctcn=E2E%20Group&keep=1`, gotoOpts)
    const request = await recorded
    expect(request.postData()).toContain('digest_email')
    expect(request.postData()).not.toContain('E2E Group')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/keep=1/, routeTimeout)
    await expect(page).not.toHaveURL(/ctt=|cti=|ctcn=/, routeTimeout)
  })
})

test.describe('signed-in home after code-splitting', () => {
  test('home loads the signed-in app', async ({ page }) => {
    await page.goto('/')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/(all(\/.*)?$|groups\/[^/]+(\/.*)?$)/, routeTimeout)
    await expect(page).not.toHaveURL(/\/login/, routeTimeout)
  })
})
