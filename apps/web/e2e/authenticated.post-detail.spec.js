import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch E — post detail routes (`PostDetail` in center vs `#detail-column`).
 * Seeded post: `scripts/seed-e2e-baseline.js` → first post in empty DB is typically id `1`, title “E2E Public Post”, group `e2e-public-group`.
 *
 * Dual-column map routes rely on `AuthLayoutRouter` `hasDetail` (paths containing `map/` + `/post/…`).
 */

test.describe.configure({ timeout: 180000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }
const mapDetailTimeout = { timeout: 120000 }

const E2E_POST_ID = '1'
const E2E_USER_ID = '1'
const PUBLIC_GROUP_SLUG = 'e2e-public-group'

async function expectSeededPostVisible (page) {
  await expect(page.getByText(/E2E Public Post/i).first()).toBeVisible(uiTimeout)
}

test.describe('Batch E: post detail & dual-column', () => {
  test('GET /post/:id loads post (global)', async ({ page }) => {
    await page.goto(`/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/post/${E2E_POST_ID}`), navTimeout)
    await expectSeededPostVisible(page)
  })

  test('GET /groups/:slug/post/:id loads post in group context', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/post/${E2E_POST_ID}`),
      navTimeout
    )
    await expectSeededPostVisible(page)
  })

  test('GET /all/map/post/:id opens detail column (All map)', async ({ page }) => {
    await page.goto(`/all/map/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/all/map/post/${E2E_POST_ID}`), navTimeout)
    await expect(page.locator('#detail-column')).toBeVisible(mapDetailTimeout)
    await expectSeededPostVisible(page)
  })

  test('GET /public/map/post/:id opens detail column (Public map)', async ({ page }) => {
    await page.goto(`/public/map/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(new RegExp(`/public/map/post/${E2E_POST_ID}`), navTimeout)
    await expect(page.locator('#detail-column')).toBeVisible(mapDetailTimeout)
    await expectSeededPostVisible(page)
  })

  test('GET /groups/:slug/map/post/:id opens detail column (group map)', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/map/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/map/post/${E2E_POST_ID}`),
      navTimeout
    )
    await expect(page.locator('#detail-column')).toBeVisible(mapDetailTimeout)
    await expectSeededPostVisible(page)
  })

  test('GET /members/:id/post/:id loads post (member route)', async ({ page }) => {
    await page.goto(`/members/${E2E_USER_ID}/post/${E2E_POST_ID}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(
      new RegExp(`/members/${E2E_USER_ID}/post/${E2E_POST_ID}`),
      navTimeout
    )
    await expectSeededPostVisible(page)
  })
})
