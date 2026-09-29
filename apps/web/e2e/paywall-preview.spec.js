import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { fetchOfferingIdForGroup } from './helpers/fetchOfferingIdForGroup.js'
import { ensureHyloCookieConsent } from './helpers/sessionAuth.js'

/**
 * Paid content before purchase (round 2, paid-content package):
 * - a signed-out buyer's 'Sign up to Purchase' opens sign up, returning to the offering
 * - the offering page opens signed out, as it does from an email's renew link
 * - the paywall shows the titles-only preview the API returns for the viewer
 *
 * Uses the seeded public paywall group (`seed-e2e-baseline.js`), where `e2e.user` is a
 * member without paid access. Signed-out checks run in a fresh context with no session.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 90000 }

const PAYWALL_GROUP_SLUG = 'e2e-paywall-group'
const PAYWALL_OFFERING_NAME = 'E2E Paywall Stream Monthly'

async function signedOutPage (browser, baseURL) {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  await ensureHyloCookieConsent(page)
  return { context, page }
}

test.describe('paid content before purchase', () => {
  let offeringId

  test.beforeAll(async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: './e2e/.auth/session.json' })
    const page = await context.newPage()
    await page.goto('/my/posts')
    await waitPastRootSessionLoading(page)
    offeringId = await fetchOfferingIdForGroup(page, PAYWALL_GROUP_SLUG, PAYWALL_OFFERING_NAME)
    await context.close()
  })

  test('the offering page opens signed out, and Sign up to Purchase goes to sign up', async ({ browser, baseURL }) => {
    expect(offeringId).toBeTruthy()
    const { context, page } = await signedOutPage(browser, baseURL)

    await page.goto(`/groups/${PAYWALL_GROUP_SLUG}/offerings/${offeringId}`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('heading', { name: PAYWALL_OFFERING_NAME })).toBeVisible(uiTimeout)

    await page.getByRole('button', { name: /Sign up to Purchase/i }).click()

    await expect(page).toHaveURL(/\/signup/, uiTimeout)
    expect(new URL(page.url()).pathname).not.toMatch(/^\/login/)
    await context.close()
  })

  test('the paywall shows the preview titles the API returns for this viewer', async ({ page }) => {
    await page.goto(`/groups/${PAYWALL_GROUP_SLUG}`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('heading', { name: /This group requires a fee to join/i })).toBeVisible(uiTimeout)
    await expect(page.getByText(PAYWALL_OFFERING_NAME)).toBeVisible(uiTimeout)

    const preview = await page.evaluate(async slug => {
      const response = await fetch('/noo/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: 'query ($slug: String) { group(slug: $slug) { id paywallPreview { postTitles actionTitles numActions } } }',
          variables: { slug }
        })
      })
      const json = await response.json()
      return json?.data?.group?.paywallPreview || null
    }, PAYWALL_GROUP_SLUG)

    const titles = preview ? [...(preview.postTitles || []), ...(preview.actionTitles || [])] : []
    if (titles.length === 0 && preview?.numActions == null) {
      await expect(page.getByTestId('paywall-preview')).toHaveCount(0)
    } else {
      const box = page.getByTestId('paywall-preview')
      await expect(box).toBeVisible(uiTimeout)
      for (const title of titles) {
        await expect(box.getByText(title, { exact: true }).first()).toBeVisible(uiTimeout)
      }
    }
  })
})
