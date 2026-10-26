/**
 * #1683 — on touch devices the chat room's action-menu Edit opens the full post
 * editor route (the one the post detail's Edit uses), which has a Save button.
 * With a mouse, Edit still edits the message inline in the chat room.
 *
 * Each test creates its own chat post in e2e-public-group, so no seeded data changes.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const GROUP = 'e2e-public-group'
const CHAT_PATH = `/groups/${GROUP}/chat`
const uiTimeout = { timeout: 60000 }
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

test.use({ storageState: 'e2e/.auth/session.json' })
test.describe.configure({ timeout: 180000 })

async function createChatPost (page, text) {
  return page.evaluate(async ({ slug, text }) => {
    const gql = async (query, variables) => {
      const res = await fetch('/noo/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query, variables })
      })
      const json = await res.json()
      if (json.errors) throw new Error(JSON.stringify(json.errors))
      return json.data
    }
    const { group } = await gql('query ($slug: String) { group(slug: $slug) { id } }', { slug })
    if (!group) throw new Error(`group ${slug} not found`)
    const create = () => gql(
      'mutation ($data: PostInput) { createPost(data: $data) { id } }',
      { data: { type: 'chat', details: `<p>${text}</p>`, groupIds: [group.id] } }
    )
    // The chromium and mobile tests post to the same chat room at the same time, and two
    // simultaneous first posts can race on the view's group_views_users row: retry once
    const data = await create().catch(error => {
      if (!String(error.message).includes('group_views_users')) throw error
      return create()
    })
    if (!data.createPost) throw new Error(`createPost returned ${JSON.stringify(data)}`)
    return data.createPost.id
  }, { slug: GROUP, text })
}

async function longPress (page, locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  // The left gutter: long presses on the message text itself are left to text selection
  const point = { x: box.x + 20, y: box.y + box.height / 2 }
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await page.waitForTimeout(800)
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
}

async function openChatWithNewPost (page, text) {
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const postId = await createChatPost(page, text)
  await page.goto(CHAT_PATH)
  await waitPastRootSessionLoading(page)
  const chatPost = page.getByTestId('chat-post').filter({ hasText: text })
  await expect(chatPost).toBeVisible(uiTimeout)
  return { postId, chatPost }
}

test('touch: action menu Edit opens the post editor route, and saving returns to the chat room', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-chrome', 'touch long-press is a phone gesture')
  const original = `E2E touch chat edit ${Date.now()}`
  const edited = `${original} (edited)`
  const { postId, chatPost } = await openChatWithNewPost(page, original)
  const editButton = chatPost.locator('[data-tooltip-content="Edit post"]')
  const modal = page.locator('#create-modal-content')
  const editUrl = new RegExp(`${CHAT_PATH}/post/${postId}/edit$`)
  const chatUrl = new RegExp(`${CHAT_PATH}/?$`)

  // Closing the editor without changes goes back to the chat room
  await longPress(page, chatPost)
  await expect(editButton).toBeVisible()
  await editButton.click()
  await expect(page).toHaveURL(editUrl, uiTimeout)
  await expect(modal.getByText('Editing Chat')).toBeVisible(uiTimeout)
  await modal.locator('.icon-Ex').click()
  await expect(page).toHaveURL(chatUrl, uiTimeout)
  await expect(modal).toHaveCount(0)
  await expect(chatPost).toBeInViewport()

  await longPress(page, chatPost)
  await expect(editButton).toBeVisible()
  await editButton.click()
  await expect(page).toHaveURL(editUrl, uiTimeout)
  await expect(modal.getByText('Editing Chat')).toBeVisible(uiTimeout)
  await expect(modal.getByText(/(Option|Alt)-Enter to save/)).toBeVisible()
  const saveButton = modal.getByTestId('post-editor-submit')
  await expect(saveButton).toBeVisible()

  const editor = modal.locator('.ProseMirror').filter({ hasText: original })
  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' (edited)')
  if (screenshotDir && fs.existsSync(screenshotDir)) {
    await page.screenshot({ path: path.join(screenshotDir, 'issue-1683-touch-edit-route.png') })
  }
  await saveButton.click()

  await expect(page).toHaveURL(chatUrl, uiTimeout)
  const editedPost = page.getByTestId('chat-post').filter({ hasText: edited })
  await expect(editedPost).toBeVisible(uiTimeout)
  await expect(editedPost).toBeInViewport()
  // Saved with the chat room's group (the chat room loads posts without their groups)
  const savedGroups = await page.evaluate(async (id) => {
    const res = await fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query: 'query ($id: ID) { post(id: $id) { groups { slug } } }', variables: { id } })
    })
    return (await res.json()).data.post.groups.map(g => g.slug)
  }, postId)
  expect(savedGroups).toEqual([GROUP])
  if (screenshotDir && fs.existsSync(screenshotDir)) {
    await page.screenshot({ path: path.join(screenshotDir, 'issue-1683-touch-after-save.png') })
  }
})

test('mouse: action menu Edit still edits inline in the chat room', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'hover is a mouse interaction')
  await page.setViewportSize({ width: 1600, height: 900 })
  const original = `E2E desktop chat edit ${Date.now()}`
  const { chatPost } = await openChatWithNewPost(page, original)

  await chatPost.hover()
  const editButton = chatPost.locator('[data-tooltip-content="Edit post"]')
  await expect(editButton).toBeVisible()
  await editButton.click()

  await expect(page).toHaveURL(new RegExp(`${CHAT_PATH}/?$`))
  await expect(chatPost.getByTestId('Save')).toBeVisible()
  await expect(chatPost.getByTestId('Cancel')).toBeVisible()
  await expect(page.locator('#create-modal-content')).toHaveCount(0)
  if (screenshotDir && fs.existsSync(screenshotDir)) {
    // Move the mouse off the nav so its hover drawer doesn't cover the chat
    await page.mouse.move(1400, 450)
    await page.screenshot({ path: path.join(screenshotDir, 'issue-1683-desktop-inline-edit.png') })
  }
})
