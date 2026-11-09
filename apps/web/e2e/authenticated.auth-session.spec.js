import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { gotoLoginAndWaitForEmail } from './helpers/waitForLoginEmailVisible.js'
import {
  openGlobalNavSettingsMenu,
  clickGlobalNavLogout,
  ensureBrowserSessionDestroyed,
  ensureHyloCookieConsent
} from './helpers/sessionAuth.js'

/**
 * Logout, session clearing, and re-login.
 * Uses `e2e.session-mutate@hylo.test` + `session-mutate-user.json` so DELETE session never
 * breaks parallel tests that share `e2e.user@hylo.test` / `session.json`.
 */

const SESSION_MUTATE_EMAIL = 'e2e.session-mutate@hylo.test'
const SESSION_MUTATE_PASSWORD = 'e2e-password-123'

test.describe.configure({ timeout: 240000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }
const bootstrapTimeout = { timeout: 120000 }

/**
 * Submits the login form as the session-mutate user and waits for the auth shell.
 * @param {import('@playwright/test').Page} page
 */
async function signInWithSessionMutate (page) {
  const emailInput = page.locator('#email')
  await expect(emailInput).toBeVisible(uiTimeout)
  await emailInput.fill(SESSION_MUTATE_EMAIL)
  await page.locator('#password').fill(SESSION_MUTATE_PASSWORD)
  await page.getByRole('button', { name: /sign\s*in/i }).click()
  await expect(page.locator('#center-column-container')).toBeVisible(bootstrapTimeout)
}

test.describe('authenticated: logout and session', () => {
  test('global nav sign out shows login; follow-up / is unauthenticated', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', err => {
      pageErrors.push(err.message)
      if (process.env.E2E_FORWARD_BROWSER_LOGS === '1') {
        process.stderr.write(`[browser][auth-session] pageerror: ${err.message}\n${err.stack || ''}\n`)
      }
    })

    // Group stream: phone chevron toggles the nav drawer. /my/posts can treat
    // it as back (one-column My home), so create/settings never enter the viewport.
    // Retries reuse session-mutate-user.json after this test DELETEs that session,
    // so restore auth via the login form when we landed on /login.
    await page.goto('/groups/e2e-public-group/all')
    await waitPastRootSessionLoading(page)
    if (/\/login/.test(page.url())) {
      await signInWithSessionMutate(page)
      await page.goto('/groups/e2e-public-group/all')
      await waitPastRootSessionLoading(page)
    }
    await expect(page.locator('#center-column-container')).toBeVisible(uiTimeout)

    await openGlobalNavSettingsMenu(page)
    await clickGlobalNavLogout(page)

    await expect(page).toHaveURL(/\/login/, navTimeout)
    await expect(page.getByRole('heading', { name: /sign in to hylo/i })).toBeVisible(uiTimeout)

    await ensureBrowserSessionDestroyed(page)
    await page.goto('/')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/login/, navTimeout)

    expect(pageErrors, pageErrors.join('\n')).toEqual([])
  })

  // The test above DELETEs the server session saved in session-mutate-user.json.
  // Start logged out so this spec does not depend on that now-invalid cookie.
  test.describe(() => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('sign out then seeded email/password login restores auth shell', async ({ page }) => {
      const pageErrors = []
      page.on('pageerror', err => {
        pageErrors.push(err.message)
        if (process.env.E2E_FORWARD_BROWSER_LOGS === '1') {
          process.stderr.write(`[browser][auth-session] pageerror: ${err.message}\n${err.stack || ''}\n`)
        }
      })

      await ensureHyloCookieConsent(page)
      await gotoLoginAndWaitForEmail(page)
      await signInWithSessionMutate(page)

      await openGlobalNavSettingsMenu(page)
      await clickGlobalNavLogout(page)
      await expect(page).toHaveURL(/\/login/, navTimeout)

      await signInWithSessionMutate(page)

      expect(pageErrors, pageErrors.join('\n')).toEqual([])
    })
  })
})
