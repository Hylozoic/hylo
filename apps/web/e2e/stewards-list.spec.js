import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { ensureHyloCookieConsent, dismissAppInstallPrompt } from './helpers/sessionAuth.js'

/**
 * D38 / M3: the Stewards list on a group's About page shows everyone holding the
 * Administrator, Moderator or Host role, so Hosts appear next to Administrators.
 * Requires the E2E seed: e2e-stewards-group (Public, public member directory) has
 * E2E Join Host as Administrator, E2E Member A as Host and E2E Member B as a plain member.
 *
 * The list is on a member's About page (someone outside the group gets the join page,
 * which has none), so this signs in as E2E Member B. The main e2e user isn't a member.
 */

// A session of its own, so signing in here never replaces the shared e2e user's
test.use({ storageState: { cookies: [], origins: [] } })
test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const MEMBER_B = { email: 'e2e.member-b@hylo.test', password: 'e2e-password-123' }

test('the About page lists a Host under Stewards', async ({ page }) => {
  await ensureHyloCookieConsent(page)
  const response = await page.request.post('/noo/graphql', {
    data: {
      query: 'mutation ($email: String, $password: String) { login(email: $email, password: $password) { error me { id } } }',
      variables: MEMBER_B
    }
  })
  expect(response.ok()).toBeTruthy()
  const { data } = await response.json()
  expect(data.login.error).toBeFalsy()

  await page.goto('/groups/e2e-stewards-group/about')
  await dismissAppInstallPrompt(page)
  await waitPastRootSessionLoading(page)

  const stewards = page.locator('section', { has: page.getByRole('heading', { name: 'Stewards', exact: true }) })
  const host = stewards.getByRole('link', { name: /E2E Member A/ })
  await expect(stewards.getByRole('link', { name: /E2E Join Host/ })).toBeVisible(uiTimeout)
  await expect(host).toBeVisible(uiTimeout)
  await expect(stewards.getByRole('link', { name: /E2E Member B/ })).toHaveCount(0)

  fs.mkdirSync(screenshotDir, { recursive: true })
  await host.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: path.resolve(screenshotDir, `${test.info().project.name}-stewards-list.png`),
    animations: 'disabled'
  })
})
