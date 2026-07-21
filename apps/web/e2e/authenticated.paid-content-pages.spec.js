import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { seedGroupMembershipLastViewed } from './helpers/seedGroupMembershipLastViewed.js'

/**
 * Batch P4 — My Transactions + Stripe checkout result pages (post-return shells).
 * Uses primary `e2e.user` (member of `e2e-public-group`).
 * Deep group URLs need membership `lastViewedAt` seeded first (see `seedGroupMembershipLastViewed`)
 * so AuthLayoutRouter first-visit redirect does not replace them with /stream.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

const PUBLIC_GROUP_SLUG = 'e2e-public-group'

test.describe('Batch P4: my transactions & payment result pages', () => {
  test('GET /my/transactions loads management shell (empty baseline)', async ({ page }) => {
    await page.goto('/my/transactions')
    await waitPastRootSessionLoading(page)

    await expect(page).toHaveURL(/\/my\/transactions/, navTimeout)
    await expect(page.getByText(/Manage your purchases and subscriptions below/i)).toBeVisible(uiTimeout)
    await expect(page.getByRole('heading', { name: /^Filters$/i })).toBeVisible(uiTimeout)
    await expect(page.getByRole('heading', { name: /No transactions yet/i })).toBeVisible(uiTimeout)
  })

  test('GET group payment success shows confirmation shell', async ({ page }) => {
    await seedGroupMembershipLastViewed(page, PUBLIC_GROUP_SLUG)
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/payment/success`)
    await waitPastRootSessionLoading(page)

    await expect(page.getByRole('heading', { name: /Payment Successful!/i })).toBeVisible(uiTimeout)
    await expect(
      page.getByText(/Thank you for your purchase/i)
    ).toBeVisible(uiTimeout)
  })

  test('GET group payment cancel shows cancelled shell', async ({ page }) => {
    await seedGroupMembershipLastViewed(page, PUBLIC_GROUP_SLUG)
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/payment/cancel`)
    await waitPastRootSessionLoading(page)

    await expect(page.getByRole('heading', { name: /Payment Cancelled/i })).toBeVisible(uiTimeout)
    await expect(page.getByText(/Your payment was cancelled/i)).toBeVisible(uiTimeout)
  })

  test('GET group payment/failure shows same cancelled shell as cancel', async ({ page }) => {
    await seedGroupMembershipLastViewed(page, PUBLIC_GROUP_SLUG)
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/payment/failure`)
    await waitPastRootSessionLoading(page)

    await expect(page.getByRole('heading', { name: /Payment Cancelled/i })).toBeVisible(uiTimeout)
  })
})
