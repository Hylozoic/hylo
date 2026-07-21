import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { fetchOfferingIdForGroup } from './helpers/fetchOfferingIdForGroup.js'
import { seedGroupMembershipLastViewed } from './helpers/seedGroupMembershipLastViewed.js'

/**
 * Batch P7 — OfferingDetails while logged in (auth shell route).
 * Seeded offering `E2E Membership Monthly` on `e2e-public-group` (`seed-e2e-baseline.js`).
 */

test.describe.configure({ timeout: 120000 })

const uiTimeout = { timeout: 60000 }

const PUBLIC_GROUP_SLUG = 'e2e-public-group'
const PUBLIC_OFFERING_NAME = 'E2E Membership Monthly'

test.describe('Batch P7: offering details (authenticated)', () => {
  test('GET /groups/:slug/offerings/:id shows seeded offering and Buy Now', async ({ page }) => {
    await page.goto('/')
    await waitPastRootSessionLoading(page)

    const offeringId = await fetchOfferingIdForGroup(page, PUBLIC_GROUP_SLUG, PUBLIC_OFFERING_NAME)
    expect(offeringId).toBeTruthy()

    await seedGroupMembershipLastViewed(page, PUBLIC_GROUP_SLUG)
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/offerings/${offeringId}`)
    await waitPastRootSessionLoading(page)

    await expect(
      page.getByRole('heading', { level: 1, name: PUBLIC_OFFERING_NAME })
    ).toBeVisible(uiTimeout)
    const purchaseBtn = page.getByTestId('offering-purchase-button')
    await purchaseBtn.scrollIntoViewIfNeeded()
    await expect(purchaseBtn).toBeVisible(uiTimeout)
    await expect(purchaseBtn).toHaveText(/Buy Now|Processing/i)
  })
})
