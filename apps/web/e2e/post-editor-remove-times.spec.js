import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Removing a post's start and/or end time in the post editor (issue #1553).
 * Each test creates its own post with a timeframe (so the chromium and mobile-chrome
 * runs never share one), removes times in the edit modal, saves, then reloads the edit page
 * and checks both the editor and the stored post. Proposals ask for confirmation first, since
 * removing the voting window changes the proposal's status.
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

async function createTimedPost (page, title, { type = 'request', start = START, end = END, extra = {} } = {}) {
  const { group } = await gql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: GROUP })
  const { createPost } = await gql(page,
    'mutation ($data: PostInput) { createPost(data: $data) { id } }',
    {
      data: {
        type,
        title,
        details: '<p>Has a timeframe to remove.</p>',
        groupIds: [group.id],
        startTime: new Date(start).getTime(),
        endTime: new Date(end).getTime(),
        timezone: 'UTC',
        ...extra
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

async function openEditor (page, postId, rowLabel = 'Timeframe') {
  await page.goto(`/groups/${GROUP}/post/${postId}/edit`)
  await waitPastRootSessionLoading(page)
  await expect(page.getByText(rowLabel, { exact: true })).toBeVisible(uiTimeout)
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

test('removing a proposal\'s voting window asks first, and Cancel keeps it', async ({ page }) => {
  const project = test.info().project.name
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  // Voting started in the past and ends in the future, so the proposal is in voting
  const postId = await createTimedPost(page, `E2E remove voting window ${project}`, {
    type: 'proposal',
    start: '2020-05-01T10:00:00.000Z',
    extra: { proposalOptions: [{ text: 'Yes', emoji: '👍' }, { text: 'No', emoji: '👎' }] }
  })
  const { post: before } = await gql(page, 'query ($id: ID) { post(id: $id) { proposalStatus } }', { id: postId })
  expect(before.proposalStatus).toEqual('voting')

  await openEditor(page, postId, 'Voting window')
  const clearStart = page.getByTestId('post-editor-clear-start-time')
  const dialog = page.getByTestId('post-editor-remove-voting-time-dialog')

  // Cancel: nothing changes
  await clearStart.click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Remove the voting window?')
  await expect(dialog).toContainText('This makes it a casual proposal: there will be no voting period and no deadline.')
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1553-proposal-confirm-${project}.png` })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(clearStart).toBeVisible()
  await expect(page.getByTestId('post-editor-clear-end-time')).toBeVisible()
  await expect(page.getByText('Select Start')).toHaveCount(0)

  // The end time: started voting would stay open with no deadline
  await page.getByTestId('post-editor-clear-end-time').click()
  await expect(dialog).toContainText('Voting will stay open with no deadline, and the proposal will never be marked as complete.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)

  // Confirm: both times go, and the saved proposal is casual
  await clearStart.click()
  await page.getByTestId('post-editor-confirm-remove-voting-time').click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Select Start')).toBeVisible()
  await expect(page.getByText('Select End')).toBeVisible()
  // Saving an edited proposal also asks (window.confirm) whether to reset the votes
  page.once('dialog', d => d.accept())
  await saveAndWait(page)

  await expect.poll(() => fetchTimes(page, postId)).toEqual({ startTime: null, endTime: null })
  const { post: after } = await gql(page, 'query ($id: ID) { post(id: $id) { proposalStatus } }', { id: postId })
  expect(after.proposalStatus).toEqual('casual')

  await openEditor(page, postId, 'Voting window')
  await expect(page.getByText('Select Start')).toBeVisible()
  await expect(page.getByText('Select End')).toBeVisible()
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1553-proposal-removed-${project}.png` })
})
