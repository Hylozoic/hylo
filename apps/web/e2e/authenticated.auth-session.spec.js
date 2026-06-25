import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import {
  dismissCookiePreferencesIfOpen,
  openGlobalNavSettingsMenu,
  clickGlobalNavLogout,
  ensureBrowserSessionDestroyed
} from './helpers/sessionAuth.js'

/**
 * Logout, session clearing, and re-login.
 * Uses `e2e.session-mutate@hylo.test` + `session-mutate-user.json` so DELETE session never
 * breaks parallel tests that share `e2e.user@hylo.test` / `session.json`.
 */

const SESSION_MUTATE_EMAIL = 'e2e.session-mutate@hylo.test'
const SESSION_MUTATE_PASSWORD = 'e2e-password-123'

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }
const bootstrapTimeout = { timeout: 120000 }

test.describe('authenticated: logout and session', () => {
  test('global nav sign out shows login; follow-up / is unauthenticated', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', err => {
      pageErrors.push(err.message)
      if (process.env.E2E_FORWARD_BROWSER_LOGS === '1') {
        process.stderr.write(`[browser][auth-session] pageerror: ${err.message}\n${err.stack || ''}\n`)
      }
    })

    await page.goto('/my/posts')
    await waitPastRootSessionLoading(page)
    await dismissCookiePreferencesIfOpen(page)

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

  test('sign out then seeded email/password login restores auth shell', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', err => {
      pageErrors.push(err.message)
      if (process.env.E2E_FORWARD_BROWSER_LOGS === '1') {
        process.stderr.write(`[browser][auth-session] pageerror: ${err.message}\n${err.stack || ''}\n`)
      }
    })

    await page.goto('/my/posts')
    await waitPastRootSessionLoading(page)
    await dismissCookiePreferencesIfOpen(page)

    await openGlobalNavSettingsMenu(page)
    await clickGlobalNavLogout(page)
    await expect(page).toHaveURL(/\/login/, navTimeout)

    await page.locator('#email').fill(SESSION_MUTATE_EMAIL)
    await page.locator('#password').fill(SESSION_MUTATE_PASSWORD)
    await page.getByRole('button', { name: /sign\s*in/i }).click()
    await expect(page.locator('#center-column-container')).toBeVisible(bootstrapTimeout)

    expect(pageErrors, pageErrors.join('\n')).toEqual([])
  })
})
