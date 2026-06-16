import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { fetchOfferingIdForGroup } from './helpers/fetchOfferingIdForGroup.js'

/**
 * Batch P2 / P6 — paywall discovery & stream paywall (`e2e-paywall-group`).
 * `e2e.user` is a plain member without paid scope (no Coordinator on that group).
 * Seeded offering `E2E Paywall Stream Monthly` (`seed-e2e-baseline.js`).
 * Warm `/my/posts` first so `checkLogin` + Redux `Me` are ready before `OfferingDetails` reads `currentUser` (avoids transient "Sign up to Purchase").
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 90000 }

const PAYWALL_GROUP_SLUG = 'e2e-paywall-group'
const PAYWALL_OFFERING_NAME = 'E2E Paywall Stream Monthly'

test.describe('Batch P2: paywall discovery (authenticated)', () => {
  test('paywall group shows purchase affordances (member without paid access)', async ({ page }) => {
    await page.goto(`/groups/${PAYWALL_GROUP_SLUG}`)
    await waitPastRootSessionLoading(page)

    await expect(page.getByRole('heading', { name: /This group requires a fee to join/i })).toBeVisible(uiTimeout)
    await expect(page.getByText(PAYWALL_OFFERING_NAME)).toBeVisible(uiTimeout)
    await expect(page.getByRole('button', { name: /Purchase Access/i })).toBeVisible(uiTimeout)
  })

  test('offering details page loads seeded offering', async ({ page }) => {
    await page.goto('/my/posts')
    await waitPastRootSessionLoading(page)
    await expect(page.locator('#center-column-container')).toBeVisible(uiTimeout)

    const offeringId = await fetchOfferingIdForGroup(page, PAYWALL_GROUP_SLUG, PAYWALL_OFFERING_NAME)
    expect(offeringId).toBeTruthy()

    await page.goto(`/groups/${PAYWALL_GROUP_SLUG}/offerings/${offeringId}`)
    await waitPastRootSessionLoading(page)

    await expect(page).toHaveURL(new RegExp(`/groups/${PAYWALL_GROUP_SLUG}/offerings/${offeringId}`), uiTimeout)
    await expect(page.getByRole('heading', { name: PAYWALL_OFFERING_NAME })).toBeVisible(uiTimeout)

    const purchaseBtn = page.getByTestId('offering-purchase-button')
    await expect(purchaseBtn).toBeVisible(uiTimeout)
    await purchaseBtn.scrollIntoViewIfNeeded()
    await expect(purchaseBtn).toHaveText(/Buy Now|Processing/i, uiTimeout)
  })
})

test.describe('Batch P6: group stream paywall (authenticated)', () => {
  test('GET /groups/:slug/stream shows paywall offerings when member lacks access', async ({ page }) => {
    await page.goto(`/groups/${PAYWALL_GROUP_SLUG}/stream`)
    await waitPastRootSessionLoading(page)

    await expect(page.getByRole('heading', { name: /This group requires a fee to join/i })).toBeVisible(uiTimeout)
    await expect(page.getByText(PAYWALL_OFFERING_NAME)).toBeVisible(uiTimeout)
    await expect(page.getByRole('button', { name: /Purchase Access/i })).toBeVisible(uiTimeout)
  })
})
