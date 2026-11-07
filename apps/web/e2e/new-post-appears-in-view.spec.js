/**
 * New posts show up straight away, at the top, in the view they belong in (#1695, #593):
 * My Posts, a group stream, a common view and a custom view — without a reload.
 *
 * Posts are created in `e2e-private-group` so public-group specs keep their seeded stream.
 * Navigation between views is in-app (history.pushState + popstate) so the Redux store survives.
 */
import { test, expect } from '@playwright/test'
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.describe.configure({ timeout: 240000 })
test.use({ storageState: 'e2e/.auth/session.json' })

const GROUP_SLUG = 'e2e-private-group'
const SEEDED_MY_POST = 'E2E Public Post'
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const uiTimeout = { timeout: 60000 }

function psql (query) {
  const dbUrl = process.env.E2E_DATABASE_URL
  if (!dbUrl || !/test/i.test(dbUrl)) throw new Error('E2E_DATABASE_URL must point at a test database')
  const result = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`psql failed: ${result.stderr}`)
  return result.stdout.trim()
}

async function goInApp (page, url) {
  await page.evaluate(to => {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: window.history.state }))
  }, url)
}

/** Opens the create-post modal over the current view (in-app) and posts a discussion. */
async function createDiscussion (page, viewPath, title) {
  await goInApp(page, `${viewPath}?create=post&newPostType=discussion`)
  const titleInput = page.getByTestId('post-editor-title')
  await expect(titleInput).toBeVisible(uiTimeout)
  await titleInput.fill(title)
  await page.getByTestId('post-editor-submit').click()
  await expect(page.getByTestId('post-editor')).toHaveCount(0, uiTimeout)
}

async function topOf (page, text) {
  const el = page.getByText(text, { exact: true }).first()
  await expect(el).toBeVisible(uiTimeout)
  return (await el.boundingBox()).y
}

function uniqueTitle (label) {
  return `E2E new ${label} ${test.info().project.name} ${Date.now()}`
}

test('a new post is first in My Posts after navigating back to it (#1695)', async ({ page }) => {
  await page.goto('/my/posts')
  await waitPastRootSessionLoading(page)
  await expect(page.getByText(SEEDED_MY_POST, { exact: true }).first()).toBeVisible(uiTimeout)

  const title = uniqueTitle('my-posts')
  await goInApp(page, `/groups/${GROUP_SLUG}/all`)
  await createDiscussion(page, `/groups/${GROUP_SLUG}/all`, title)

  await goInApp(page, '/my/posts')
  expect(await topOf(page, title)).toBeLessThan(await topOf(page, SEEDED_MY_POST))

  if (test.info().project.name === 'chromium') {
    fs.mkdirSync(screenshotDir, { recursive: true })
    await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1695-my-posts.png') })
  }
})

test('a new post is first in the group stream and a common view (#593)', async ({ page }) => {
  await page.goto(`/groups/${GROUP_SLUG}/all`)
  await waitPastRootSessionLoading(page)
  const first = uniqueTitle('stream-a')
  await createDiscussion(page, `/groups/${GROUP_SLUG}/all`, first)
  await expect(page.getByText(first, { exact: true }).first()).toBeVisible(uiTimeout)
  const second = uniqueTitle('stream-b')
  await createDiscussion(page, `/groups/${GROUP_SLUG}/all`, second)
  expect(await topOf(page, second)).toBeLessThan(await topOf(page, first))

  await goInApp(page, `/groups/${GROUP_SLUG}/discussions`)
  await expect(page.getByText(second, { exact: true }).first()).toBeVisible(uiTimeout)
  const third = uniqueTitle('discussions')
  await createDiscussion(page, `/groups/${GROUP_SLUG}/discussions`, third)
  expect(await topOf(page, third)).toBeLessThan(await topOf(page, second))

  if (test.info().project.name === 'chromium') {
    fs.mkdirSync(screenshotDir, { recursive: true })
    await page.screenshot({ path: path.resolve(screenshotDir, 'issue-593-discussions.png') })
  }
})

test('a new post is first in a custom view that includes its type (#593)', async ({ page }) => {
  const viewName = `E2E Custom 1695 ${test.info().project.name}`
  const groupId = psql(`SELECT id FROM groups WHERE slug = '${GROUP_SLUG}'`)
  psql(`DELETE FROM group_views WHERE group_id = ${groupId} AND name = '${viewName}'`)
  const viewId = psql(`INSERT INTO group_views (group_id, type, name, "order", settings, created_at, updated_at)
    VALUES (${groupId}, 'custom', '${viewName}', 90, '{"postTypes":["discussion"],"defaultViewMode":"cards","defaultSort":"created"}'::jsonb, now(), now())
    RETURNING id`).split('\n')[0]

  try {
    const viewPath = `/groups/${GROUP_SLUG}/custom/${viewId}`
    await page.goto(viewPath)
    await waitPastRootSessionLoading(page)
    const first = uniqueTitle('custom-a')
    await createDiscussion(page, viewPath, first)
    await expect(page.getByText(first, { exact: true }).first()).toBeVisible(uiTimeout)
    const second = uniqueTitle('custom-b')
    await createDiscussion(page, viewPath, second)
    expect(await topOf(page, second)).toBeLessThan(await topOf(page, first))

    if (test.info().project.name === 'chromium') {
      fs.mkdirSync(screenshotDir, { recursive: true })
      await page.screenshot({ path: path.resolve(screenshotDir, 'issue-593-custom-view.png') })
    }
  } finally {
    psql(`DELETE FROM group_views WHERE id = ${viewId}`)
  }
})
