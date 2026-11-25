import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * #1805: in a non-English locale, picking a tab from the member profile's content
 * dropdown used to store the translated label as the tab id, so the profile crashed.
 */

test.describe.configure({ timeout: 120000 })

const uiTimeout = { timeout: 60000 }

test('member profile tabs switch in German without crashing', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hylo-i18n-lng', 'de')
  })
  await page.goto('/members/1')
  await waitPastRootSessionLoading(page)
  await expect(page.getByRole('heading', { level: 1, name: /E2E User/i })).toBeVisible(uiTimeout)

  const center = page.locator('#center-column')
  const toggle = center.getByRole('button', { name: /Übersicht/ })
  await expect(toggle).toBeVisible(uiTimeout)
  await toggle.click()
  await center.getByText('Kommentare', { exact: true }).click()

  await expect(center.getByRole('heading', { name: /Kommentare von E2E User/ })).toBeVisible(uiTimeout)
  await expect(center.getByRole('button', { name: /Kommentare/ })).toBeVisible(uiTimeout)
  await page.screenshot({ path: `test-results/issue-1805-profile-comments-de-${testInfo.project.name}.png` })
})
