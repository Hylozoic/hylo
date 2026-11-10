import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { gotoLoginAndWaitForEmail } from './helpers/waitForLoginEmailVisible.js'
import { ensureHyloCookieConsent } from './helpers/sessionAuth.js'

/**
 * A group admin lets the other admins of the post's group edit it (issue #1727).
 * The main E2E user (Administrator of the seeded groups) creates each post, so the
 * chromium and mobile-chrome runs never share one. `e2e.session-mutate` is a second
 * Administrator of `e2e-public-group`: it logs in to a fresh context (its own session,
 * so the logout specs that use that user can't end it) and edits as the other admin.
 */

test.describe.configure({ timeout: 480000 })

const uiTimeout = { timeout: 60000 }
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR
const OTHER_ADMIN_EMAIL = 'e2e.session-mutate@hylo.test'
const OTHER_ADMIN_PASSWORD = 'e2e-password-123'

async function gql (page, query, variables) {
  return page.evaluate(async ({ query, variables }) => {
    const res = await fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    })
    return res.json()
  }, { query, variables })
}

async function groupId (page, slug) {
  const { data } = await gql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug })
  return data.group.id
}

async function createPost (page, title, groupIds, extra = {}) {
  const res = await gql(page,
    'mutation ($data: PostInput) { createPost(data: $data) { id } }',
    { data: { type: 'discussion', title, details: '<p>Shared with the admins.</p>', groupIds, ...extra } }
  )
  expect(res.errors).toBeUndefined()
  return res.data.createPost.id
}

async function fetchPost (page, id) {
  const { data } = await gql(page, 'query ($id: ID) { post(id: $id) { title groupAdminsCanEdit canEdit creator { id } } }', { id })
  return data.post
}

async function openEditor (page, groupSlug, postId) {
  await page.goto(`/groups/${groupSlug}/post/${postId}/edit`)
  await waitPastRootSessionLoading(page)
  await expect(page.locator('#create-modal-content .ProseMirror').getByText('Shared with the admins.')).toBeVisible(uiTimeout)
}

async function saveAndWait (page) {
  const saved = page.waitForResponse(res => res.url().includes('/noo/graphql') &&
    (res.request().postData() || '').includes('updatePost'))
  await page.getByTestId('post-editor-submit').click()
  const res = await saved
  expect((await res.json()).errors).toBeUndefined()
}

test('a group admin can let the other admins of the group edit their post', async ({ page }) => {
  const project = test.info().project.name
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const privateGroupId = await groupId(page, 'e2e-private-group')
  const postId = await createPost(page, `E2E admins can edit ${project}`, [privateGroupId])

  await openEditor(page, 'e2e-private-group', postId)
  const toggle = page.getByTestId('post-editor-group-admins-can-edit')
  await expect(toggle).toBeVisible(uiTimeout)
  const label = 'Allow other members who can manage content in E2E Private Group to edit this post.'
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(toggle).toHaveAttribute('aria-label', label)
  await toggle.scrollIntoViewIfNeeded()
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1727-icon-off-${project}.png` })

  // The tooltip is hidden below the sm breakpoint (components/Tooltip), so only check it on wide screens
  if (page.viewportSize().width >= 640) {
    await toggle.hover()
    await expect(page.getByRole('tooltip').filter({ hasText: label })).toBeVisible(uiTimeout)
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1727-icon-tooltip-${project}.png` })
  }

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  // Away from the toggle (and from the global nav, which expands on hover)
  const { width, height } = page.viewportSize()
  await page.mouse.move(width - 10, height - 10)
  await expect(page.getByRole('tooltip').filter({ hasText: label })).toBeHidden(uiTimeout)
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1727-icon-on-${project}.png` })
  await saveAndWait(page)
  await expect.poll(async () => (await fetchPost(page, postId)).groupAdminsCanEdit).toBe(true)

  // Still on after a reload of the editor
  await openEditor(page, 'e2e-private-group', postId)
  await expect(page.getByTestId('post-editor-group-admins-can-edit')).toHaveAttribute('aria-pressed', 'true', uiTimeout)
})

test('the toggle is not offered while the post is in more than one group', async ({ page }) => {
  const project = test.info().project.name
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const ids = [await groupId(page, 'e2e-private-group'), await groupId(page, 'e2e-public-group')]
  const postId = await createPost(page, `E2E two groups ${project}`, ids)

  await openEditor(page, 'e2e-private-group', postId)
  await expect(page.getByText('Title', { exact: true })).toBeVisible(uiTimeout)
  await expect(page.getByTestId('post-editor-group-admins-can-edit')).toHaveCount(0)
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1727-two-groups-${project}.png` })
})

test('another admin of the group can edit the post, until it is shared to a second group', async ({ page, browser }) => {
  const project = test.info().project.name
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const publicGroupId = await groupId(page, 'e2e-public-group')
  const privateGroupId = await groupId(page, 'e2e-private-group')
  const title = `E2E co-edited ${project}`
  const postId = await createPost(page, title, [publicGroupId], { groupAdminsCanEdit: true })
  const creatorId = (await fetchPost(page, postId)).creator.id

  // Empty storage state: without it the new context starts logged in as the main E2E user
  const otherContext = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: page.viewportSize(),
    storageState: { cookies: [], origins: [] }
  })
  const other = await otherContext.newPage()
  try {
    await test.step('log in as the other admin', async () => {
      await ensureHyloCookieConsent(other)
      const emailInput = await gotoLoginAndWaitForEmail(other)
      await emailInput.fill(OTHER_ADMIN_EMAIL)
      await other.getByLabel('password', { exact: true }).fill(OTHER_ADMIN_PASSWORD)
      await other.getByRole('button', { name: /sign\s*in/i }).click()
      await expect(other.locator('#center-column-container')).toBeVisible({ timeout: 120000 })
    })

    expect((await fetchPost(other, postId)).canEdit).toBe(true)
    await test.step('open the editor as the other admin', () => openEditor(other, 'e2e-public-group', postId))
    await expect(other.getByText('Title', { exact: true })).toBeVisible(uiTimeout)
    // Only the creator decides who can edit
    await expect(other.getByTestId('post-editor-group-admins-can-edit')).toHaveCount(0)
    const titleInput = other.getByTestId('post-editor-title')
    await titleInput.fill(`${title} (edited by another admin)`)
    if (SCREENSHOT_DIR) await other.screenshot({ path: `${SCREENSHOT_DIR}/issue-1727-other-admin-editing-${project}.png` })
    await saveAndWait(other)

    await expect.poll(async () => (await fetchPost(page, postId)).title).toBe(`${title} (edited by another admin)`)
    const afterEdit = await fetchPost(page, postId)
    expect(afterEdit.creator.id).toBe(creatorId)
    expect(afterEdit.groupAdminsCanEdit).toBe(true)

    // The creator shares it to a second group: the other admin can no longer edit it
    const res = await gql(page,
      'mutation ($id: ID, $data: PostInput) { updatePost(id: $id, data: $data) { id } }',
      { id: postId, data: { type: 'discussion', title: afterEdit.title, details: '<p>Shared with the admins.</p>', groupIds: [publicGroupId, privateGroupId] } }
    )
    expect(res.errors).toBeUndefined()
    expect((await fetchPost(other, postId)).canEdit).toBe(false)
    const rejected = await gql(other,
      'mutation ($id: ID, $data: PostInput) { updatePost(id: $id, data: $data) { id } }',
      { id: postId, data: { type: 'discussion', title: 'Should not save', details: '<p>x</p>', groupIds: [publicGroupId] } }
    )
    expect(JSON.stringify(rejected.errors)).toContain("don't have permission")
  } catch (error) {
    await other.screenshot({ path: test.info().outputPath('other-admin-page.png') }).catch(() => {})
    throw error
  } finally {
    await otherContext.close().catch(() => {})
  }
})
