import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch K — `/welcome/*` (`WelcomeWizardRouter`).
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

test.describe('Batch K: welcome wizard routes', () => {
  test('GET /welcome redirects to upload-photo step', async ({ page }) => {
    await page.goto('/welcome')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/welcome\/upload-photo/, navTimeout)
    await expect(page.getByText(/STEP 1\/3/i)).toBeVisible(uiTimeout)
  })

  test('GET /welcome/add-location shows location step', async ({ page }) => {
    await page.goto('/welcome/add-location')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/welcome\/add-location/, navTimeout)
    await expect(page.getByText(/STEP 2\/3/i)).toBeVisible(uiTimeout)
    await expect(page.getByPlaceholder(/Where do you call home/i)).toBeVisible(uiTimeout)
  })

  test('GET /welcome/explore shows completion shell', async ({ page }) => {
    await page.goto('/welcome/explore')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/welcome\/explore/, navTimeout)
    await expect(page.getByRole('heading', { name: /Welcome to Hylo/i })).toBeVisible(uiTimeout)
  })
})
