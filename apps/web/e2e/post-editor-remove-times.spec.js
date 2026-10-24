import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Removing a post's start and/or end time in the post editor (issue #1553).
 * Each test creates its own request post with a timeframe (so the chromium and mobile-chrome
 * runs never share one), removes times in the edit modal, saves, then reloads the edit page
 * and checks both the editor and the stored post.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const GROUP = 'e2e-public-group'
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR
const START = '2030-05-01T10:00:00.000Z'
const END = '2030-05-01T12:00:00.000Z'

async function gql (page, query, variables) {
  return page.evaluate(async ({ query, variables }) => {
    const res = await fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    })
    const json = await res.json()
    if (json.errors) throw new Error(JSON.stringify(json.errors))
    return json.data
  }, { query, variables })
}

async function createTimedPost (page, title) {
  const { group } = await gql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: GROUP })
  const { createPost } = await gql(page,
    'mutation ($data: PostInput) { createPost(data: $data) { id } }',
    {
      data: {
        type: 'request',
        title,
        details: '<p>Has a timeframe to remove.</p>',
        groupIds: [group.id],
        startTime: new Date(START).getTime(),
        endTime: new Date(END).getTime(),
        timezone: 'UTC'
      }
    }
  )
  return createPost.id
}

async function fetchTimes (page, id) {
  const { post } = await gql(page, 'query ($id: ID) { post(id: $id) { startTime endTime } }', { id })
  const iso = value => (value ? new Date(value).toISOString() : null)
  return { startTime: iso(post.startTime), endTime: iso(post.endTime) }
}

async function openEditor (page, postId) {
  await page.goto(`/groups/${GROUP}/post/${postId}/edit`)
  await waitPastRootSessionLoading(page)
  await expect(page.getByText('Timeframe', { exact: true })).toBeVisible(uiTimeout)
  await expect(page.locator('#create-modal-content .ProseMirror').getByText('Has a timeframe to remove.')).toBeVisible(uiTimeout)
}

async function saveAndWait (page) {
  const saved = page.waitForResponse(res => res.url().includes('/noo/graphql') &&
    (res.request().postData() || '').includes('updatePost'))
  await page.getByTestId('post-editor-submit').click()
  const res = await saved
  expect((await res.json()).errors).toBeUndefined()
}

test('removing the end time keeps the start and survives a reload', async ({ page }) => {
  const project = test.info().project.name
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const postId = await createTimedPost(page, `E2E remove end time ${project}`)

  await openEditor(page, postId)
  const clearEnd = page.getByTestId('post-editor-clear-end-time')
  await expect(clearEnd).toBeVisible()
  await expect(page.getByTestId('post-editor-clear-start-time')).toBeVisible()
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1553-before-${project}.png` })

  await clearEnd.click()
  await expect(page.getByText('Select End')).toBeVisible()
  await expect(clearEnd).toHaveCount(0)
  await expect(page.getByText('Select Start')).toHaveCount(0)
  await saveAndWait(page)

  await expect.poll(() => fetchTimes(page, postId)).toEqual({ startTime: START, endTime: null })

  await openEditor(page, postId)
  await expect(page.getByText('Select End')).toBeVisible()
  await expect(page.getByText('Select Start')).toHaveCount(0)
  await expect(page.getByTestId('post-editor-clear-start-time')).toBeVisible()
  await expect(page.getByTestId('post-editor-clear-end-time')).toHaveCount(0)
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1553-end-removed-${project}.png` })
})

test('removing the start time removes both times and survives a reload', async ({ page }) => {
  const project = test.info().project.name
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const postId = await createTimedPost(page, `E2E remove start time ${project}`)

  await openEditor(page, postId)
  await page.getByTestId('post-editor-clear-start-time').click()
  await expect(page.getByText('Select Start')).toBeVisible()
  await expect(page.getByText('Select End')).toBeVisible()
  await saveAndWait(page)

  await expect.poll(() => fetchTimes(page, postId)).toEqual({ startTime: null, endTime: null })

  await openEditor(page, postId)
  await expect(page.getByText('Select Start')).toBeVisible()
  await expect(page.getByText('Select End')).toBeVisible()
  await expect(page.getByTestId('post-editor-clear-start-time')).toHaveCount(0)
  await expect(page.getByTestId('post-editor-clear-end-time')).toHaveCount(0)
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1553-both-removed-${project}.png` })
})
