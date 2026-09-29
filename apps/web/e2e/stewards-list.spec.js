import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * D38 / M3: the Stewards list on a group's About page shows everyone holding the
 * Administrator, Moderator or Host role, so Hosts appear next to Administrators.
 * Requires the E2E seed: e2e-stewards-group (Public, public member directory) has
 * E2E Join Host as Administrator, E2E Member A as Host and E2E Member B as a plain member.
 */

test.use({ storageState: 'e2e/.auth/session.json' })
test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

test('the About page lists a Host under Stewards', async ({ page }) => {
  await page.goto('/groups/e2e-stewards-group/about')
  await waitPastRootSessionLoading(page)

  const administrator = page.getByRole('link', { name: /E2E Join Host/ })
  const host = page.getByRole('link', { name: /E2E Member A/ })
  await expect(administrator.first()).toBeVisible(uiTimeout)
  await expect(host.first()).toBeVisible(uiTimeout)
  await expect(page.getByRole('link', { name: /E2E Member B/ })).toHaveCount(0)

  fs.mkdirSync(screenshotDir, { recursive: true })
  await host.first().scrollIntoViewIfNeeded()
  await page.screenshot({
    path: path.resolve(screenshotDir, `${test.info().project.name}-stewards-list.png`),
    animations: 'disabled'
  })
})
