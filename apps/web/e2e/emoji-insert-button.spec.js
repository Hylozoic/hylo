import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Emoji button in the editor formatting toolbar (issue #1682). On mouse/trackpad devices the
 * formatting toolbar (post editor, chat, comments) has an emoji button that inserts at the cursor;
 * on touch devices it's hidden (the on-screen keyboard has emoji). There is no always-visible emoji
 * button. Comments get a formatting toggle like chat's. Uses its own posts, edits them (so drafts are
 * keyed to that post), and never sends the chat or comment; the chat input is cleared again, which
 * removes its draft.
 */

test.use({ storageState: 'e2e/.auth/session.json' })
test.describe.configure({ timeout: 240000 })

const uiTimeout = { timeout: 60000 }
const GROUP = 'e2e-public-group'
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR
const EMOJI_BUTTON = 'editor-toolbar-emoji-button'

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

async function screenshot (page, name, locator) {
  if (!SCREENSHOT_DIR) return
  const path = `${SCREENSHOT_DIR}/issue-1682-${name}-${test.info().project.name}.png`
  await (locator || page).screenshot({ path })
}

test('post editor: toolbar emoji goes into the last focused of title and body', async ({ page }) => {
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const postId = await createPost(page, `Emoji title ${test.info().project.name}`)

  await page.goto(`/groups/${GROUP}/post/${postId}/edit`)
  await waitPastRootSessionLoading(page)
  const title = page.locator('.PostEditorTitle input')
  await expect(title).toHaveValue(/Emoji title/, uiTimeout)
  // No emoji button in the bottom icon row any more
  await expect(page.getByTestId('add-image-icon').first()).toBeVisible(uiTimeout)
  await expect(page.getByTestId('post-editor-emoji-button')).toHaveCount(0)
  const button = page.getByTestId(EMOJI_BUTTON)

  if (isTouchProject()) {
    await expect(button).toHaveCount(0)
    return
  }

  // One toolbar, one emoji button (link and other fields have none)
  await expect(button).toHaveCount(1)

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
  // Undo removes just the emoji
  await page.keyboard.press('ControlOrMeta+z')
  await expect(body).not.toContainText('🚀')
  await expect(body).toContainText('Body text more')
  // The cursor stays in the body
  await page.keyboard.type('!')
  await expect(body).toContainText('more!')

  await button.click()
  await expect(page.locator('em-emoji-picker')).toBeVisible(uiTimeout)
  await screenshot(page, 'post-editor-toolbar')
})

test('chat input: emoji button lives in the formatting toolbar', async ({ page }) => {
  await page.goto(`/groups/${GROUP}/chat`)
  await waitPastRootSessionLoading(page)
  const send = page.getByTestId('chat-send-button')
  await expect(send).toBeVisible(uiTimeout)
  const toggle = page.getByTestId('chat-toolbar-toggle')
  const button = page.getByTestId(EMOJI_BUTTON)

  // Hidden until the formatting toolbar is opened
  await expect(button).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  if (isTouchProject()) {
    await expect(button).toHaveCount(0)
    return
  }

  await expect(button).toBeVisible(uiTimeout)
  const editor = page.locator('.ChatEditorContent .ProseMirror')
  await editor.click()
  await page.keyboard.type('Hello chat')
  await pickEmoji(page, button, 'wave', '👋')
  await expect(editor).toContainText('Hello chat👋')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(editor).not.toContainText('👋')
  await expect(editor).toContainText('Hello chat')

  await screenshot(page, 'chat-toolbar')
  await button.click()
  await expect(page.locator('em-emoji-picker')).toBeVisible(uiTimeout)
  await screenshot(page, 'chat-toolbar-picker')
  await page.keyboard.press('Escape')

  // Clear the input again so no chat draft is left behind
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await expect(editor).not.toContainText('Hello chat')
})

test('comment input: formatting toggle shows the toolbar with the emoji button', async ({ page }) => {
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const postId = await createPost(page, `Emoji comments ${test.info().project.name}`)

  await page.goto(`/groups/${GROUP}/post/${postId}`)
  await waitPastRootSessionLoading(page)
  const form = page.locator('.CommentForm')
  await expect(form).toBeVisible(uiTimeout)
  const toggle = form.getByTestId('comment-toolbar-toggle')
  await expect(toggle).toBeVisible(uiTimeout)
  await expect(page.getByTestId('comment-emoji-button')).toHaveCount(0)
  const button = form.getByTestId(EMOJI_BUTTON)
  await expect(button).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(form.locator('button:has(svg.lucide-bold)')).toBeVisible(uiTimeout)

  if (isTouchProject()) {
    await expect(button).toHaveCount(0)
    return
  }

  await expect(button).toBeVisible(uiTimeout)
  const editor = form.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('Nice post')
  await pickEmoji(page, button, 'thumbs up', '👍')
  await expect(editor).toContainText('Nice post👍')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(editor).not.toContainText('👍')
  await expect(editor).toContainText('Nice post')

  await screenshot(page, 'comment-toolbar')

  // Toggling off hides the toolbar again
  await toggle.click()
  await expect(button).toHaveCount(0)
})
