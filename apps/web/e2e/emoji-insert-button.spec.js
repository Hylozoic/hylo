import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Emoji button in text inputs (issue #1682). On mouse/trackpad devices the post editor, chat input
 * and comment input get an emoji button that inserts at the cursor; on touch devices it's hidden
 * (the on-screen keyboard has emoji). Uses its own post, edits it (so drafts are keyed to that post),
 * and never sends the chat or comment; the chat input is cleared again, which removes its draft.
 */

test.use({ storageState: 'e2e/.auth/session.json' })
test.describe.configure({ timeout: 240000 })

const uiTimeout = { timeout: 60000 }
const GROUP = 'e2e-public-group'
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR

const isTouchProject = () => test.info().project.name.startsWith('mobile')

async function createPost (page, title) {
  return page.evaluate(async ({ slug, title }) => {
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
    const { createPost } = await gql(
      'mutation ($data: PostInput) { createPost(data: $data) { id } }',
      { data: { type: 'discussion', title, details: '<p>Body text</p>', groupIds: [group.id] } }
    )
    return createPost.id
  }, { slug: GROUP, title })
}

/** Opens the picker from `button`, searches for `query` and clicks the emoji `native`. */
async function pickEmoji (page, button, query, native) {
  await button.click()
  const picker = page.locator('em-emoji-picker')
  await expect(picker).toBeVisible(uiTimeout)
  await picker.locator('input[type="search"]').fill(query)
  await picker.locator(`button[aria-label="${native}"]`).first().click(uiTimeout)
  await expect(picker).toBeHidden()
}

async function screenshot (page, name) {
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1682-${name}-${test.info().project.name}.png` })
}

test('post editor: emoji goes into the last focused of title and body', async ({ page }) => {
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const postId = await createPost(page, `Emoji title ${test.info().project.name}`)

  await page.goto(`/groups/${GROUP}/post/${postId}/edit`)
  await waitPastRootSessionLoading(page)
  const title = page.locator('.PostEditorTitle input')
  await expect(title).toHaveValue(/Emoji title/, uiTimeout)
  const button = page.getByTestId('post-editor-emoji-button')

  if (isTouchProject()) {
    await expect(page.getByTestId('add-image-icon').first()).toBeVisible(uiTimeout)
    await expect(button).toHaveCount(0)
    return
  }

  // Title: insert at the cursor (after "Emoji"), not at the end
  await title.click()
  await title.press('Home')
  for (let i = 0; i < 'Emoji'.length; i++) await title.press('ArrowRight')
  await pickEmoji(page, button, 'tada', '🎉')
  await expect(title).toHaveValue(/^Emoji🎉 title/)

  // Body: once the body was focused, the emoji goes there and the title is untouched
  const body = page.locator('.PostEditorContent .ProseMirror')
  await body.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type(' more')
  await pickEmoji(page, button, 'rocket', '🚀')
  await expect(body).toContainText('Body text more🚀')
  await expect(title).toHaveValue(/^Emoji🎉 title/)
  // The cursor stays in the body after the emoji
  await page.keyboard.type('!')
  await expect(body).toContainText('more🚀!')

  // Not offered for link fields: only one emoji button in the editor
  await expect(button).toHaveCount(1)

  // Same size as its neighbours in the icon row: the icon matches the location pin's svg,
  // the clickable box matches the font icons' (attach image / file)
  const sizes = await page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect()
      return { width: Math.round(r.width), height: Math.round(r.height), centerY: Math.round(r.y + r.height / 2) }
    }
    const emoji = document.querySelector('[data-testid="post-editor-emoji-button"]')
    const row = emoji.parentElement
    return {
      emojiButton: box(emoji),
      emojiIcon: box(emoji.querySelector('svg')),
      imageIcon: box(row.querySelector('[data-testid="add-image-icon"]')),
      fileIcon: box(row.querySelector('[data-testid="add-file-icon"]')),
      locationIcon: row.querySelector('svg.lucide-map-pin') ? box(row.querySelector('svg.lucide-map-pin')) : null
    }
  })
  await test.info().attach('icon-row-sizes', { body: JSON.stringify(sizes, null, 2), contentType: 'application/json' })
  expect(sizes.emojiButton.width).toBe(sizes.fileIcon.width)
  expect(sizes.emojiButton.height).toBe(sizes.fileIcon.width)
  if (sizes.locationIcon) {
    expect(sizes.emojiIcon.width).toBe(sizes.locationIcon.width)
    expect(sizes.emojiIcon.height).toBe(sizes.locationIcon.height)
  }
  expect(Math.abs(sizes.emojiButton.centerY - sizes.fileIcon.centerY)).toBeLessThanOrEqual(2)
  const iconRow = button.locator('xpath=../..')
  await test.info().attach('icon-row', { body: await iconRow.screenshot(), contentType: 'image/png' })
  if (SCREENSHOT_DIR) await iconRow.screenshot({ path: `${SCREENSHOT_DIR}/issue-1682-post-editor-icons-${test.info().project.name}.png` })

  await button.click()
  await expect(page.locator('em-emoji-picker')).toBeVisible(uiTimeout)
  await screenshot(page, 'post-editor')
})

test('chat input: emoji button sits left of the formatting and send buttons', async ({ page }) => {
  await page.goto(`/groups/${GROUP}/chat`)
  await waitPastRootSessionLoading(page)
  const send = page.getByTestId('chat-send-button')
  await expect(send).toBeVisible(uiTimeout)
  const button = page.getByTestId('chat-emoji-button')

  if (isTouchProject()) {
    await expect(button).toHaveCount(0)
    return
  }

  const toggle = page.getByTestId('chat-toolbar-toggle')
  const [emojiBox, toggleBox, sendBox] = await Promise.all([button.boundingBox(), toggle.boundingBox(), send.boundingBox()])
  expect(emojiBox.x).toBeLessThan(toggleBox.x)
  expect(toggleBox.x).toBeLessThan(sendBox.x)

  const editor = page.locator('.ChatEditorContent .ProseMirror')
  await editor.click()
  await page.keyboard.type('Hello chat')
  await pickEmoji(page, button, 'wave', '👋')
  await expect(editor).toContainText('Hello chat👋')

  await button.click()
  await expect(page.locator('em-emoji-picker')).toBeVisible(uiTimeout)
  await screenshot(page, 'chat')
  await page.keyboard.press('Escape')

  // Clear the input again so no chat draft is left behind
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await expect(editor).not.toContainText('Hello chat')
})

test('comment input: emoji button sits right of send and attach image', async ({ page }) => {
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const postId = await createPost(page, `Emoji comments ${test.info().project.name}`)

  await page.goto(`/groups/${GROUP}/post/${postId}`)
  await waitPastRootSessionLoading(page)
  const form = page.locator('.CommentForm')
  await expect(form).toBeVisible(uiTimeout)
  const upload = form.getByTestId('upload-button')
  await expect(upload).toBeVisible(uiTimeout)
  const button = page.getByTestId('comment-emoji-button')

  if (isTouchProject()) {
    await expect(button).toHaveCount(0)
    return
  }

  const [emojiBox, uploadBox] = await Promise.all([button.boundingBox(), upload.boundingBox()])
  expect(emojiBox.x).toBeGreaterThan(uploadBox.x)

  const editor = form.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('Nice post')
  await pickEmoji(page, button, 'thumbs up', '👍')
  await expect(editor).toContainText('Nice post👍')

  await button.click()
  await expect(page.locator('em-emoji-picker')).toBeVisible(uiTimeout)
  await screenshot(page, 'comment')
})
