import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch J — create-post query param (`?create=post`) and post edit path
 * (`/post/:id/edit`) for `groups` / `all` / `public` / `my`.
 * Seeded post id `1` (“E2E Public Post”) from `scripts/seed-e2e-baseline.js`.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

const E2E_POST_ID = '1'
const PUBLIC_GROUP_SLUG = 'e2e-public-group'

async function expectCreatePostShell (page, urlPattern) {
  await waitPastRootSessionLoading(page)
  await expect(page).toHaveURL(urlPattern, navTimeout)
  await expect(page.locator('#create-modal-content')).toBeVisible(uiTimeout)
}

async function expectEditPostShell (page, urlPattern) {
  await waitPastRootSessionLoading(page)
  await expect(page).toHaveURL(urlPattern, navTimeout)
  await expect(page.getByText(/E2E Public Post/i).first()).toBeVisible(uiTimeout)
}

test.describe('Batch J: create post modal', () => {
  test('GET groups/:slug/:view?create=post opens editor', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/all?create=post`)
    await expectCreatePostShell(
      page,
      new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/all\\?create=post`)
    )
  })

  test('GET all/:view?create=post opens editor', async ({ page }) => {
    await page.goto('/all/all?create=post')
    await expectCreatePostShell(page, /\/all\/all\?create=post/)
  })

  test('GET public/:view?create=post opens editor', async ({ page }) => {
    await page.goto('/public/all?create=post')
    await expectCreatePostShell(page, /\/public\/all\?create=post/)
  })

  test('GET my/:view?create=post opens editor', async ({ page }) => {
    await page.goto('/my/posts?create=post')
    await expectCreatePostShell(page, /\/my\/posts\?create=post/)
  })
})

test.describe('Batch J: edit post modal', () => {
  test('GET groups/…/post/:id/edit opens editor', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/post/${E2E_POST_ID}/edit`)
    await expectEditPostShell(
      page,
      new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/post/${E2E_POST_ID}/edit`)
    )
  })

  test('GET all/post/:id/edit opens editor', async ({ page }) => {
    await page.goto(`/all/post/${E2E_POST_ID}/edit`)
    await expectEditPostShell(page, new RegExp(`/all/post/${E2E_POST_ID}/edit`))
  })

  test('GET public/post/:id/edit opens editor', async ({ page }) => {
    await page.goto(`/public/post/${E2E_POST_ID}/edit`)
    await expectEditPostShell(page, new RegExp(`/public/post/${E2E_POST_ID}/edit`))
  })

  test('GET my/…/post/:id/edit opens editor', async ({ page }) => {
    await page.goto(`/my/posts/post/${E2E_POST_ID}/edit`)
    await expectEditPostShell(
      page,
      new RegExp(`/my/posts/post/${E2E_POST_ID}/edit`)
    )
  })
})
