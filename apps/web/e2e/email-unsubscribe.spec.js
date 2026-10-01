import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * One-click unsubscribe (D34) and the emailed settings page's unsubscribe choices (D35).
 *
 * - An unsubscribe link from a group digest opens /email/unsubscribe, which asks first:
 *   nothing changes until the Unsubscribe button is pressed; then that group's digest is Never.
 * - The emailed settings page offers four unsubscribe choices with "Everything except
 *   direct" preselected (it is not pressed here, so the seed user keeps their settings).
 *
 * Tokens come from the isolated E2E runner (scripts/run-isolated-e2e.js): E2E_UNSUBSCRIBE_JWT
 * (apps/backend/scripts/print-e2e-unsubscribe-jwt.js, the E2E public group's digest) and
 * E2E_NOTIFICATION_PAGE_JWT. Screenshots go to e2e/screenshots.
 */

test.describe.configure({ timeout: 180000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

async function capture (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  const project = test.info().project.name
  await page.screenshot({ path: path.resolve(screenshotDir, `email-unsubscribe-${name}-${project}.png`), animations: 'disabled' })
}

const describeLink = async (request, token) => {
  const response = await request.get(`/noo/email/unsubscribe/describe?token=${encodeURIComponent(token)}`)
  expect(response.ok()).toBe(true)
  return response.json()
}

test.describe('an unsubscribe link from a group digest', () => {
  const token = process.env.E2E_UNSUBSCRIBE_JWT
  const settingsToken = process.env.E2E_NOTIFICATION_PAGE_JWT

  test('asks first, and stops the digest only when Unsubscribe is pressed', async ({ page }) => {
    test.skip(!token || !settingsToken, 'The isolated E2E runner mints E2E_UNSUBSCRIBE_JWT and E2E_NOTIFICATION_PAGE_JWT when OIDC_KEYS is set')
    test.skip(test.info().project.name !== 'chromium', 'changes the seed user\'s digest setting, so it runs once')

    // What the digest setting was, to put it back afterwards
    const before = await (await page.request.get(`/noo/user/notification-settings?token=${encodeURIComponent(settingsToken)}`)).json()

    try {
      // Start from a digest that is on
      if ((await describeLink(page.request, token)).done) {
        await page.request.post('/noo/user/update-notification-settings', { data: { token: settingsToken, digestFrequency: 'daily' } })
      }

      await page.goto(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      await waitPastRootSessionLoading(page)
      await expect(page.getByTestId('email-unsubscribe')).toBeVisible(navTimeout)
      await expect(page.getByRole('heading', { name: /Stop the email digest from E2E Public Group\?/ })).toBeVisible(uiTimeout)
      await capture(page, 'confirm')

      // Opening the page (as a link scanner would) changed nothing
      expect((await describeLink(page.request, token)).done).toBe(false)

      await page.getByTestId('confirm-unsubscribe').click()
      await expect(page.getByRole('heading', { name: "You're unsubscribed." })).toBeVisible(uiTimeout)
      await capture(page, 'done')

      const after = await describeLink(page.request, token)
      expect(after.done).toBe(true)
      expect(after.descriptor).toBe('group_digest')
    } finally {
      if (before?.digestFrequency && before.digestFrequency !== 'mixed') {
        await page.request.post('/noo/user/update-notification-settings', {
          data: { token: settingsToken, digestFrequency: before.digestFrequency }
        })
      }
    }
  })

  test('a GET of the one-click address only redirects to the confirmation page', async ({ page }) => {
    test.skip(!token, 'The isolated E2E runner mints E2E_UNSUBSCRIBE_JWT when OIDC_KEYS is set')

    const response = await page.request.get(`/noo/email/unsubscribe?token=${encodeURIComponent(token)}`, { maxRedirects: 0 })
    expect(response.status()).toBe(302)
    expect(response.headers().location).toMatch(/\/email\/unsubscribe\?token=/)
  })
})

test.describe('the emailed settings page', () => {
  // Signed in, /notifications opens the in-app settings instead
  test.use({ storageState: { cookies: [], origins: [] } })

  test('offers four unsubscribe choices with "Everything except direct" preselected', async ({ page }) => {
    const settingsToken = process.env.E2E_NOTIFICATION_PAGE_JWT
    test.skip(!settingsToken, 'The isolated E2E runner mints E2E_NOTIFICATION_PAGE_JWT when OIDC_KEYS is set')

    await page.goto(`/notifications?token=${encodeURIComponent(settingsToken)}&name=E2E`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('heading', { name: /Hi E2E/i })).toBeVisible(navTimeout)

    const choices = page.getByTestId('unsubscribe-choices')
    await choices.scrollIntoViewIfNeeded()
    await expect(choices.getByRole('radio')).toHaveCount(4)
    await expect(choices.getByRole('radio', { name: /Everything except direct/ })).toBeChecked()
    await expect(choices.getByRole('radio', { name: /Fewer emails \(digest only\)/ })).not.toBeChecked()
    await expect(choices.getByRole('radio', { name: /No group emails/ })).not.toBeChecked()
    await capture(page, 'settings-choices')
  })
})
