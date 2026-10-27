/**
 * #1699: when the server rejects a new post (e.g. a chat-only space that
 * doesn't accept discussions), the post editor shows the error instead of
 * the Post button silently doing nothing. The CreatePost response is stubbed
 * with the backend's real error shape so no seeded group has to be restricted.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP = 'e2e-public-group'
const ERROR = 'E2E Public Group does not accept discussion posts'

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
      body: JSON.stringify({ data: null, errors: [{ message: ERROR, path: ['createPost'] }] })
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
  await expect(error).toHaveText(ERROR, { timeout: 30000 })
  expect(createPostCalls).toBe(1)
  // The modal stays open with the user's work intact, and they can try again.
  await expect(title).toHaveValue('Rejected post 1699')
  await expect(submit).toBeEnabled()

  await page.screenshot({ path: path.resolve(screenshotDir, `issue-1699-save-error-${test.info().project.name}.png`) })
})
