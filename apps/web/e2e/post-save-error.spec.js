/**
 * #1699: when the server rejects a new post (e.g. a chat-only space that
 * doesn't accept discussions), the post editor shows the error instead of
 * the Post button silently doing nothing. The CreatePost response is stubbed
 * with the backend's real error shape so no seeded group has to be restricted.
 * The server sends the blocking destinations and post type as data (extensions);
 * the web builds the sentence in the user's language.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP = 'e2e-public-group'
// The backend names only the blocking destinations, a space as "Parent Group / Space"
const SERVER_ERROR = {
  message: 'English fallback from the server',
  path: ['createPost'],
  extensions: { code: 'POST_TYPE_NOT_ACCEPTED', postType: 'discussion', destinations: ['E2E Public Group / partnerships'] }
}
const BANNER = 'E2E Public Group / partnerships does not accept Discussion posts'

test.use({ storageState: 'e2e/.auth/session.json' })
test.setTimeout(240000)

test('post editor shows the server error when a post is rejected', async ({ page }) => {
  fs.mkdirSync(screenshotDir, { recursive: true })
  let createPostCalls = 0
  await page.route('**/noo/graphql', async (route) => {
    const body = route.request().postData() || ''
    if (!body.includes('CreatePost')) return route.fallback()
    createPostCalls++
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null, errors: [SERVER_ERROR] })
    })
  })

  await page.goto(`/groups/${GROUP}/all?create=post`)
  await waitPastRootSessionLoading(page)
  const title = page.getByTestId('post-editor-title')
  await expect(title).toBeVisible({ timeout: 60000 })
  await title.fill('Rejected post 1699')

  const submit = page.getByTestId('post-editor-submit')
  await expect(submit).toBeEnabled({ timeout: 30000 })
  await submit.click()

  const error = page.getByTestId('post-editor-save-error')
  await expect(error).toHaveText(BANNER, { timeout: 30000 })
  expect(createPostCalls).toBe(1)
  // The modal stays open with the user's work intact, and they can try again.
  await expect(title).toHaveValue('Rejected post 1699')
  await expect(submit).toBeEnabled()

  await page.screenshot({ path: path.resolve(screenshotDir, `issue-1699-save-error-${test.info().project.name}.png`) })
})
