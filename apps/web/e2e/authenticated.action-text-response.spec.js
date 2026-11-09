import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Text responses to track actions keep their formatting (issue #1067).
 * Creates an action post with a `text` completion in `e2e-public-group` (the E2E user administers it),
 * answers it with the rich text editor, then checks the responder view and the admin responses dialog.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const PUBLIC_GROUP_SLUG = 'e2e-public-group'
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR

async function createTextActionPost (page) {
  return page.evaluate(async (slug) => {
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
      {
        data: {
          type: 'action',
          title: 'E2E Reflection Action',
          details: '<p>Share a short reflection.</p>',
          groupIds: [group.id],
          completionAction: 'text',
          completionActionSettings: { instructions: 'Write a reflection to complete this action.' }
        }
      }
    )
    return createPost.id
  }, PUBLIC_GROUP_SLUG)
}

test('text completion response keeps paragraphs, line breaks and formatting', async ({ page }) => {
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const postId = await createTextActionPost(page)

  await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/post/${postId}`)
  await waitPastRootSessionLoading(page)
  await expect(page.getByText('Write a reflection to complete this action.')).toBeVisible(uiTimeout)

  const submit = page.getByRole('button', { name: 'Submit', exact: true })
  await expect(submit).toBeDisabled()

  const editor = page.locator('.ProseMirror').filter({ has: page.locator('[data-placeholder="Write your response"]') }).first()
  await editor.click()
  await page.keyboard.type('First paragraph of my reflection.')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Second paragraph, line one')
  // Mobile emulation doesn't turn Shift+Enter into a line break, so only check those on desktop
  const checkLineBreaks = !test.info().project.name.startsWith('mobile')
  await page.keyboard.press(checkLineBreaks ? 'Shift+Enter' : 'Space')
  await page.keyboard.type('and line two.')
  await page.keyboard.press('Enter')
  await page.keyboard.press('ControlOrMeta+b')
  await page.keyboard.type('Bold takeaway')
  await page.keyboard.press('ControlOrMeta+b')
  await page.keyboard.press('Enter')
  await page.keyboard.type('- Point one')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Point two')
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1067-editing-${test.info().project.name}.png` })

  await submit.click()

  const completed = page.getByText(/Your response was:/)
  await expect(completed).toBeVisible(uiTimeout)
  const section = page.locator('div.border-dashed').filter({ has: completed }).first()
  await expect(section.locator('p', { hasText: 'First paragraph of my reflection.' })).toBeVisible()
  if (checkLineBreaks) await expect(section.locator('p', { hasText: 'Second paragraph, line one' }).locator('br')).toHaveCount(1)
  await expect(section.locator('strong', { hasText: 'Bold takeaway' })).toBeVisible()
  await expect(section.locator('li')).toHaveCount(2)
  if (SCREENSHOT_DIR) await section.screenshot({ path: `${SCREENSHOT_DIR}/issue-1067-responder-${test.info().project.name}.png` })

  // The admin completions list is fetched with the post, so reload to see the new response
  await page.reload()
  await waitPastRootSessionLoading(page)
  await page.getByRole('button', { name: 'View All Responses' }).click(uiTimeout)
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('strong', { hasText: 'Bold takeaway' })).toBeVisible(uiTimeout)
  await expect(dialog.locator('li')).toHaveCount(2)
  if (checkLineBreaks) await expect(dialog.locator('p', { hasText: 'Second paragraph, line one' }).locator('br')).toHaveCount(1)
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1067-admin-dialog-${test.info().project.name}.png` })
})
