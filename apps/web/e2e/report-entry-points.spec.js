import { test, expect, request as playwrightRequest } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { PUBLIC_GROUP_SLUG } from './helpers/invitationLinksSeed.js'

/**
 * Report and Block entry points (D32), as the seeded e2e user:
 * - a direct message thread offers Block, Report to Hylo and Leave conversation,
 *   in that order, and Report sends a staff report
 * - someone else's comment offers Report comment, which opens the group report form
 *
 * The other person is the seeded session-mutate user (see auth.session-mutate.setup.js
 * and scripts/seed-e2e-baseline.js), who shares e2e-public-group with the e2e user.
 * Their comment is written through the API from a separate signed-in request context.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const OTHER_EMAIL = 'e2e.session-mutate@hylo.test'
const OTHER_PASSWORD = 'e2e-password-123'

async function graphql (request, query, variables = {}) {
  const response = await request.post('/noo/graphql', { data: { query, variables } })
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  expect(body.errors, JSON.stringify(body.errors)).toBeUndefined()
  return body.data
}

async function signInOther () {
  const other = await playwrightRequest.newContext({ baseURL: test.info().project.use.baseURL })
  const { login } = await graphql(other,
    'mutation ($email: String, $password: String) { login(email: $email, password: $password) { error me { id } } }',
    { email: OTHER_EMAIL, password: OTHER_PASSWORD }
  )
  expect(login.error).toBeFalsy()
  return { other, otherId: login.me.id }
}

test('a conversation offers Block first, then Report to Hylo and Leave conversation', async ({ page, request }, testInfo) => {
  const { other, otherId } = await signInOther()
  const { findOrCreateThread } = await graphql(request,
    'mutation ($data: MessageThreadInput) { findOrCreateThread(data: $data) { id } }',
    { data: { participantIds: [otherId] } }
  )
  await other.dispose()

  await page.goto(`/messages/${findOrCreateThread.id}`)
  await waitPastRootSessionLoading(page)

  await page.getByTestId('thread-actions-trigger').click()
  const menu = page.getByTestId('thread-actions-menu')
  await expect(menu).toBeVisible(uiTimeout)
  await expect(menu.getByRole('menuitem')).toHaveText([/^Block /, 'Report to Hylo', 'Leave conversation'])
  await page.screenshot({ path: testInfo.outputPath('dm-thread-options.png') })

  await menu.getByRole('menuitem', { name: 'Report to Hylo' }).click()
  await expect(page.getByTestId('staff-report-explainer')).toBeVisible(uiTimeout)
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Spam' }).click()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('Thanks. Your report went to the Hylo team.')).toBeVisible(uiTimeout)
  await page.screenshot({ path: testInfo.outputPath('dm-report-sent.png') })
})

test("someone else's comment offers Report comment", async ({ page, request }, testInfo) => {
  const { group } = await graphql(request, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: PUBLIC_GROUP_SLUG })
  const { createPost } = await graphql(request,
    'mutation ($data: PostInput) { createPost(data: $data) { id } }',
    { data: { type: 'discussion', title: `E2E report comment ${Date.now()}`, details: '<p>Comment below</p>', groupIds: [group.id] } }
  )

  const { other } = await signInOther()
  await graphql(other,
    'mutation ($data: CommentInput) { createComment(data: $data) { id } }',
    { data: { postId: String(createPost.id), text: '<p>A comment to report</p>' } }
  )
  await other.dispose()

  await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/post/${createPost.id}`)
  await waitPastRootSessionLoading(page)

  const comment = page.locator('.CommentContainer', { hasText: 'A comment to report' })
  await expect(comment).toBeVisible(uiTimeout)
  await comment.hover()
  await comment.getByRole('button', { name: 'Report comment' }).click()
  await expect(page.getByRole('heading', { name: 'Explanation for Flagging' })).toBeVisible(uiTimeout)
  await page.screenshot({ path: testInfo.outputPath('comment-report-form.png') })
})
