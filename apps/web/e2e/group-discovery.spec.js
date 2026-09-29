import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Group discovery: the Explorer's "Recently active" default sort, groups in the
 * main search (and its link to the Explorer when nothing matches), and the
 * "New public groups" review page in Management.
 *
 * Seed: `apps/backend/scripts/seed-e2e-baseline.js` lists "E2E Outsider Group"
 * (Public, listed in the Explorer, the login user is not a member).
 *
 * The review page needs the login user's id in the backend's HYLO_ADMINS; set
 * E2E_SUPER_ADMIN=1 when it is, otherwise that test is skipped.
 */

test.use({ storageState: 'e2e/.auth/session.json' })
test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

test.describe('Group discovery', () => {
  test('the Group Explorer sorts by Recently active by default', async ({ page }) => {
    await page.goto('/public/groups')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/public\/groups/, navTimeout)
    await expect(page.getByText(/Sort by:/)).toBeVisible(uiTimeout)
    await expect(page.getByText('Recently active', { exact: true })).toBeVisible(uiTimeout)
  })

  test('the main search finds a listed Public group', async ({ page }) => {
    await page.goto('/search?t=Outsider')
    await waitPastRootSessionLoading(page)

    const groups = page.getByTestId('search-groups')
    await expect(groups.getByText('E2E Outsider Group')).toBeVisible(uiTimeout)
    await expect(groups.getByRole('link', { name: /E2E Outsider Group/ })).toHaveAttribute('href', '/groups/e2e-outsider-only/about')

    await page.getByText('Groups', { exact: true }).first().click()
    await expect(page.getByTestId('search-group-result').first()).toBeVisible(uiTimeout)
  })

  test('a search with no results links to the Explorer with the term', async ({ page }) => {
    await page.goto('/search?t=zzqxnomatchzz')
    await waitPastRootSessionLoading(page)

    const link = page.getByTestId('search-explorer-link')
    await expect(link).toBeVisible(uiTimeout)
    await link.click()

    await expect(page).toHaveURL(/\/public\/groups\?search=zzqxnomatchzz/, navTimeout)
    await expect(page.getByPlaceholder('Search groups by keyword')).toHaveValue('zzqxnomatchzz', uiTimeout)
  })

  test('the review page lists new public groups for Hylo admins', async ({ page }) => {
    test.skip(process.env.E2E_SUPER_ADMIN !== '1', 'needs the login user in the backend HYLO_ADMINS')

    await page.goto('/management/site/new-public-groups')
    await waitPastRootSessionLoading(page)

    const review = page.getByTestId('explorer-review')
    await expect(review.getByRole('heading', { name: 'New public groups' })).toBeVisible(uiTimeout)
    await expect(review.getByTestId('explorer-review-row').first().or(review.getByText('No groups are waiting for review.'))).toBeVisible(uiTimeout)
  })
})
