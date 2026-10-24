import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Long unbroken strings must wrap inside messages, chat posts and comments instead of
 * pushing the thread off the page (issue #453). Code blocks may scroll inside themselves.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const PUBLIC_GROUP_SLUG = 'e2e-public-group'
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR

// The CSV header from the issue: no spaces, so the browser has no natural break point
const CSV_HEADER = 'HYBAS_ID,PFAF_ID,latitude,longitude,Formatted_Address,Postal_Code,Administrative_Area_Level_1,Administrative_Area_Level_2,Sublocality,Neighborhood,Locality,Country'
const CSV_ROW = '7070530180,7429469,39.63790681,-105.3126321,"27559 Fireweed Dr, Evergreen, CO 80439, USA",80439,Colorado,Jefferson County,,Hiwan Hills,Evergreen,United States'
const LONG_URL = 'https://example.com/' + 'a-very-long-path-segment-without-any-spaces-'.repeat(6) + 'end?query=' + 'x'.repeat(80)
const LONG_CODE = 'const_' + 'reallyLongIdentifierWithoutSpaces'.repeat(8)

const LONG_HTML = [
  '<p>Pasting the headers from my data:</p>',
  `<p>${CSV_HEADER}<br>${CSV_ROW}</p>`,
  `<p><a href="${LONG_URL}">${LONG_URL}</a></p>`,
  `<p>Inline code: <code>${LONG_CODE}</code></p>`,
  `<pre><code>${CSV_HEADER}\n${LONG_CODE}</code></pre>`,
  '<p>A normal sentence afterwards, which should wrap at spaces like usual.</p>'
].join('')

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

async function groupInfo (page) {
  const { group } = await gql(page,
    'query ($slug: String) { group(slug: $slug) { id members(first: 20) { items { id name } } } }',
    { slug: PUBLIC_GROUP_SLUG })
  return group
}

/**
 * How far the page and (optionally) a scroll container can be scrolled sideways, and how far
 * any rendered rich text pokes out past the bounds element. Code blocks scroll inside
 * themselves, so only the block itself is measured, not its text.
 */
async function measureOverflow (page, { bounds, scroller, content }) {
  return page.evaluate(({ bounds, scroller, content }) => {
    const boundsRight = document.querySelector(bounds).getBoundingClientRect().right
    let contentOverflow = 0
    document.querySelectorAll(content).forEach(el => {
      [el, ...el.querySelectorAll('*')].forEach(node => {
        if (node.closest('pre') && node.tagName !== 'PRE') return
        contentOverflow = Math.max(contentOverflow, node.getBoundingClientRect().right - boundsRight)
      })
    })
    const scrollEl = scroller && document.querySelector(scroller)
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scroller: scrollEl ? scrollEl.scrollWidth - scrollEl.clientWidth : 0,
      content: Math.round(contentOverflow)
    }
  }, { bounds, scroller, content })
}

function expectNoOverflow (overflow) {
  expect(overflow.page, 'page scrolls horizontally').toBeLessThanOrEqual(1)
  expect(overflow.scroller, 'container scrolls horizontally').toBeLessThanOrEqual(1)
  expect(overflow.content, 'text extends past the container').toBeLessThanOrEqual(1)
}

async function screenshot (page, name) {
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-453-${name}-${test.info().project.name}.png` })
}

test('direct message with a long unbroken string wraps inside the thread', async ({ page }) => {
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const group = await groupInfo(page)
  // Each project messages a different member so parallel runs don't share a thread
  const partnerName = test.info().project.name.includes('mobile') ? 'E2E Member B' : 'E2E Member A'
  const partner = group.members.items.find(m => m.name === partnerName)
  expect(partner).toBeTruthy()

  const { findOrCreateThread } = await gql(page,
    'mutation ($data: MessageThreadInput) { findOrCreateThread(data: $data) { id } }',
    { data: { participantIds: [partner.id] } })
  await gql(page,
    'mutation ($data: MessageInput) { createMessage(data: $data) { id } }',
    { data: { messageThreadId: findOrCreateThread.id, text: LONG_HTML } })

  await page.goto(`/messages/${findOrCreateThread.id}`)
  await waitPastRootSessionLoading(page)
  const list = page.locator('#message-list')
  await expect(list.getByText('A normal sentence afterwards')).toBeVisible(uiTimeout)

  const overflow = await measureOverflow(page, { bounds: '#message-list', scroller: '#message-list', content: '#message-list .global-postContent' })
  await screenshot(page, 'dm')
  expectNoOverflow(overflow)
})

test('chat post with a long unbroken string wraps inside the chat room', async ({ page }) => {
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const group = await groupInfo(page)
  const marker = `Chat overflow check ${Date.now()}`
  await gql(page,
    'mutation ($data: PostInput) { createPost(data: $data) { id } }',
    { data: { type: 'chat', details: `<p>${marker}</p>${LONG_HTML}`, groupIds: [group.id] } })

  await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/chat`)
  await waitPastRootSessionLoading(page)
  await expect(page.locator('#chats').getByText(marker)).toBeVisible(uiTimeout)

  // #chats itself also holds an off-canvas drawer, so only measure the rendered posts against it
  const overflow = await measureOverflow(page, { bounds: '#chats', content: '#chats .global-postContent' })
  await screenshot(page, 'chat')
  expectNoOverflow(overflow)
})

test('post and comment with a long unbroken string wrap inside the post detail', async ({ page }) => {
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const group = await groupInfo(page)
  const { createPost } = await gql(page,
    'mutation ($data: PostInput) { createPost(data: $data) { id } }',
    { data: { type: 'discussion', title: 'E2E long comment overflow', details: `<p>Post body</p>${LONG_HTML}`, groupIds: [group.id] } })
  await gql(page,
    'mutation ($data: CommentInput) { createComment(data: $data) { id } }',
    { data: { postId: createPost.id, text: LONG_HTML } })

  await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/post/${createPost.id}`)
  await waitPastRootSessionLoading(page)
  await expect(page.locator('.CommentContainer').getByText('A normal sentence afterwards')).toBeVisible(uiTimeout)

  const overflow = await measureOverflow(page, { bounds: '#center-column', scroller: '#center-column', content: '#center-column .global-postContent' })
  await page.locator('.CommentContainer').first().scrollIntoViewIfNeeded()
  await screenshot(page, 'comment')
  expectNoOverflow(overflow)
})
