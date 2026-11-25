import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * The kanban board at phone width with touch dragging (mobile-chrome), and paging a long
 * column with "Load more" (chromium). Each uses its own seeded group, so they don't share
 * a board with authenticated.tasks.spec.js.
 */

test.describe.configure({ timeout: 240000 })

const uiTimeout = { timeout: 60000 }
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

async function screenshot (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({ path: path.resolve(screenshotDir, `${name}.png`) })
}

async function graphql (page, query, variables) {
  const res = await page.request.post('/noo/graphql', { data: { query, variables } })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

/** A finger drag with Chrome's touch events: press, hold past the board's touch delay, move, lift. */
async function touchDrag (page, from, to) {
  const cdp = await page.context().newCDPSession(page)
  const point = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from.x, from.y) })
  await page.waitForTimeout(400)
  const steps = 16
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps
    const y = from.y + ((to.y - from.y) * i) / steps
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, y) })
    await page.waitForTimeout(30)
  }
  await page.waitForTimeout(200)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test('phone width: the board fits the screen and a card can be dragged by touch', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Touch dragging at phone width')
  const title = `Touch task ${Date.now()}`
  const { group } = await graphql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: 'e2e-private-group' })
  await graphql(page,
    'mutation ($data: PostInput) { createPost(data: $data) { id } }',
    { data: { type: 'task', title, groupIds: [group.id] } })

  await page.goto('/groups/e2e-private-group/tasks')
  await waitPastRootSessionLoading(page)
  const board = page.getByTestId('task-board')
  await expect(board).toBeVisible(uiTimeout)
  const column = name => board.locator(`[data-testid="task-column"][data-column-name="${name}"]`)
  const card = column('To do').locator(`[data-task-title="${title}"]`)
  await expect(card).toBeVisible(uiTimeout)

  // Columns scroll sideways inside the board; the page itself never scrolls sideways
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  const firstColumn = await column('To do').boundingBox()
  const viewport = page.viewportSize()
  expect(firstColumn.width).toBeLessThan(viewport.width)
  // The next column peeks in, so it's clear the board scrolls sideways
  const second = await column('In progress').boundingBox()
  expect(second.x).toBeLessThan(viewport.width)
  await screenshot(page, 'tasks-board-mobile')

  // Press and hold the card, then drag it onto the next column
  const from = await card.boundingBox()
  await touchDrag(page,
    { x: from.x + from.width / 2, y: from.y + from.height / 2 },
    { x: Math.min(second.x + 40, viewport.width - 8), y: second.y + 60 })
  await expect(column('In progress').locator(`[data-task-title="${title}"]`)).toBeVisible(uiTimeout)
  await expect(column('To do').locator(`[data-task-title="${title}"]`)).toHaveCount(0)

  // The move was saved
  await page.reload()
  await waitPastRootSessionLoading(page)
  const moved = column('In progress').locator(`[data-task-title="${title}"]`)
  await expect(moved).toBeVisible(uiTimeout)
  await moved.scrollIntoViewIfNeeded()
  await screenshot(page, 'tasks-board-mobile-dragged')
})

test('a long column shows 100 tasks and loads the rest with "Load more"', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Creates 101 tasks; once is enough')
  const stamp = Date.now()
  const { group } = await graphql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: 'e2e-test-space' })
  const { createTaskStatus: status } = await graphql(page,
    'mutation ($groupId: ID, $name: String) { createTaskStatus(groupId: $groupId, name: $name) { id name } }',
    { groupId: group.id, name: `Long ${stamp}` })
  for (let i = 1; i <= 101; i++) {
    await graphql(page,
      'mutation ($data: PostInput) { createPost(data: $data) { id } }',
      { data: { type: 'task', title: `Long task ${i} ${stamp}`, groupIds: [group.id], taskStatusId: status.id } })
  }

  await page.goto('/groups/e2e-test-space/tasks')
  await waitPastRootSessionLoading(page)
  const board = page.getByTestId('task-board')
  await expect(board).toBeVisible(uiTimeout)
  const column = board.locator(`[data-testid="task-column"][data-column-name="${status.name}"]`)
  await expect(column.getByTestId('task-column-count')).toHaveText('101', uiTimeout)
  await expect(column.getByTestId('task-card')).toHaveCount(100, uiTimeout)
  await expect(column.locator(`[data-task-title="Long task 101 ${stamp}"]`)).toHaveCount(0)

  const loadMore = column.getByTestId('task-column-load-more')
  await loadMore.scrollIntoViewIfNeeded()
  await screenshot(page, 'tasks-board-load-more')
  await loadMore.click()
  await expect(column.getByTestId('task-card')).toHaveCount(101, uiTimeout)
  await expect(column.locator(`[data-task-title="Long task 101 ${stamp}"]`)).toBeVisible(uiTimeout)
  await expect(loadMore).toHaveCount(0)
})
