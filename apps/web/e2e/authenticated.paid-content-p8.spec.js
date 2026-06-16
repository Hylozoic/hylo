import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { seedGroupMembershipLastViewed } from './helpers/seedGroupMembershipLastViewed.js'

/**
 * Batch P8 — Paid content edge UX without Stripe Checkout.
 * - OfferingDetails + unknown DB id → GraphQL error shell (`Offering not found`).
 * - My Transactions: changing filters with zero rows shows filtered-empty copy (vs baseline empty).
 */

test.describe.configure({ timeout: 120000 })

const uiTimeout = { timeout: 60000 }
const PUBLIC_GROUP_SLUG = 'e2e-public-group'

test.describe('Batch P8: offering error shell & transactions filter empty state', () => {
  test('GET /groups/:slug/offerings/:id shows error shell for unknown offering id', async ({ page }) => {
    await seedGroupMembershipLastViewed(page, PUBLIC_GROUP_SLUG)
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/offerings/999999999`)
    await waitPastRootSessionLoading(page)

    await expect(page.getByRole('heading', { name: /^Error$/ })).toBeVisible(uiTimeout)
    await expect(page.getByText(/Offering not found/i)).toBeVisible(uiTimeout)
  })

  test('GET /my/transactions filter shows No transactions found when filters exclude all rows', async ({
    page
  }) => {
    await page.goto('/my/transactions')
    await waitPastRootSessionLoading(page)

    await expect(page.getByRole('heading', { name: /No transactions yet/i })).toBeVisible(uiTimeout)

    await page.locator('#filter-status').click()
    await page.getByRole('option', { name: /^Active$/i }).click()

    await expect(page.getByRole('heading', { name: /No transactions found/i })).toBeVisible(uiTimeout)
    await expect(page.getByText(/Try adjusting your filters to see more results/i)).toBeVisible(uiTimeout)
  })
})
