import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch J — `CreateModal` routes (chooser + post edit) for `groups` / `all` / `public` / `my`.
 * One smoke URL per pattern per context — see `AuthLayoutRouter` CreateModal `<Route>` list.
 * Seeded post id `1` (“E2E Public Post”) from `scripts/seed-e2e-baseline.js`.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

const E2E_POST_ID = '1'
const PUBLIC_GROUP_SLUG = 'e2e-public-group'

async function expectCreateChooserShell (page, urlPattern) {
  await waitPastRootSessionLoading(page)
  await expect(page).toHaveURL(urlPattern, navTimeout)
  await expect(page.getByRole('heading', { name: /What would you like to create/i })).toBeVisible(uiTimeout)
}

async function expectEditPostShell (page, urlPattern) {
  await waitPastRootSessionLoading(page)
  await expect(page).toHaveURL(urlPattern, navTimeout)
  await expect(page.getByText(/E2E Public Post/i).first()).toBeVisible(uiTimeout)
}

test.describe('Batch J: create modal (chooser)', () => {
  test('GET groups/:slug/:view/create opens chooser', async ({ page }) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/stream/create`)
    await expectCreateChooserShell(
      page,
      new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/stream/create`)
    )
  })

  test('GET all/:view/create opens chooser', async ({ page }) => {
    await page.goto('/all/stream/create')
    await expectCreateChooserShell(page, /\/all\/stream\/create/)
  })

  test('GET public/:view/create opens chooser', async ({ page }) => {
    await page.goto('/public/stream/create')
    await expectCreateChooserShell(page, /\/public\/stream\/create/)
  })

  test('GET my/:view/create opens chooser', async ({ page }) => {
    await page.goto('/my/posts/create')
    await expectCreateChooserShell(page, /\/my\/posts\/create/)
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
