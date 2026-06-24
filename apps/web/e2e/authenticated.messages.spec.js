import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch G — direct messages (`ThreadList` in nav, `Messages` in center).
 * Empty DB has no threads: `/messages` stays on URL with empty state (or redirects to first thread if present).
 * `/messages/new` uses `messageThreadId === 'new'` (see `Messages.js`).
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

test.describe('Batch G: messages', () => {
  test('GET /messages loads thread list (redirects to first thread when threads exist)', async ({
    page
  }) => {
    await page.goto('/messages')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/messages(\/\d+)?$/, navTimeout)
    await expect(page.getByPlaceholder(/Search messages/i)).toBeVisible(uiTimeout)
  })

  test('GET /messages/new loads compose / people-picker shell', async ({ page }) => {
    await page.goto('/messages/new')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/messages\/new/, navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page).toHaveTitle(/Hylo/i, uiTimeout)
  })
})
