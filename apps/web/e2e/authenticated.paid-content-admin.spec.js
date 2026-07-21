import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

const PUBLIC_GROUP_SLUG = 'e2e-public-group'
const SEEDED_OFFERING_NAME = 'E2E Membership Monthly'

function groupSettingsPath (suffix = '') {
  return `/groups/${PUBLIC_GROUP_SLUG}/settings/paid-content${suffix}`
}

test.describe('Batch P1: paid content admin UI', () => {
  test('GET paid-content account tab loads admin payments shell', async ({ page }) => {
    await page.goto(groupSettingsPath())
    await waitPastRootSessionLoading(page)

    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/settings/paid-content/?$`), navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page.getByRole('heading', { name: /Accept Payments for E2E Public Group/i })).toBeVisible(uiTimeout)
    await expect(page.getByRole('heading', { name: /Account Active/i })).toBeVisible(uiTimeout)
  })

  test('GET paid-content offerings tab loads seeded offering', async ({ page }) => {
    await page.goto(groupSettingsPath('/offerings'))
    await waitPastRootSessionLoading(page)

    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/settings/paid-content/offerings`), navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page.getByRole('heading', { name: /Setup Paid Content Offerings/i })).toBeVisible(uiTimeout)
    await expect(page.getByText(SEEDED_OFFERING_NAME)).toBeVisible(uiTimeout)
  })

  test('GET paid-content content-access tab loads management shell', async ({ page }) => {
    await page.goto(groupSettingsPath('/content-access'))
    await waitPastRootSessionLoading(page)

    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/settings/paid-content/content-access`), navTimeout)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    await expect(page.getByRole('heading', { name: /Manage Paid Content Access/i })).toBeVisible(uiTimeout)
  })
})
