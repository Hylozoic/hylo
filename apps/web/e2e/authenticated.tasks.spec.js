import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Tasks: create a task post, change its status from the post header, and take it.
 * Uses the seeded `e2e-public-group` (scripts/seed-e2e-baseline.js), where e2e.user is a steward.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const GROUP_SLUG = 'e2e-public-group'
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

async function screenshot (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({ path: path.resolve(screenshotDir, `${name}.png`) })
}

test('create a task, move it with the status chip, and take it', async ({ page }) => {
  const title = `E2E task ${Date.now()}`

  // Create the task
  await page.goto(`/groups/${GROUP_SLUG}/all?create=post&newPostType=task`)
  await waitPastRootSessionLoading(page)
  const editor = page.locator('#create-modal-content')
  await expect(editor).toBeVisible(uiTimeout)
  await expect(editor.getByTestId('task-assignees-field')).toBeVisible(uiTimeout)
  await editor.getByTestId('post-editor-title').fill(title)
  await screenshot(page, 'tasks-editor')
  await page.getByTestId('post-editor-submit').click()
  await expect(editor).toBeHidden(uiTimeout)

  // The card shows the task's status: the first column of the group's board
  const card = page.locator('[data-testid="post-card"]', { hasText: title }).first()
  await expect(card).toBeVisible(uiTimeout)
  const chip = card.getByTestId('task-status-chip')
  await expect(chip).toHaveText(/To do/, uiTimeout)
  await screenshot(page, 'tasks-card-status')

  // Open the task and move it to another column from the post page
  await card.getByText(title).first().click()
  const detailChip = page.getByTestId('task-status-chip').last()
  await expect(detailChip).toBeVisible(uiTimeout)
  await detailChip.click()
  const options = page.getByTestId('task-status-option')
  await expect(options).toHaveCount(4, uiTimeout)
  await expect(options.nth(1)).toHaveText(/In progress/)
  await expect(options.nth(3)).toBeVisible(uiTimeout)
  await options.nth(1).click()
  await expect(page.getByTestId('task-status-chip').last()).toHaveText(/In progress/, uiTimeout)

  // Take the task, then step off it
  const takeButton = page.getByTestId('task-take-button')
  await expect(takeButton).toHaveText(/I’ll take this/, uiTimeout)
  await takeButton.click()
  await expect(takeButton).toHaveText(/Step off/, uiTimeout)
  await screenshot(page, 'tasks-post-page')
  await takeButton.click()
  await expect(takeButton).toHaveText(/I’ll take this/, uiTimeout)

  // Completing it from the menu marks the task done everywhere
  await page.getByTestId('task-status-chip').last().click()
  await page.getByTestId('task-status-option').nth(3).click()
  await expect(page.getByTestId('task-status-chip').last()).toHaveText(/Complete/, uiTimeout)

  // Back on the stream, the day's task activity is collated into one summary card
  await page.goto(`/groups/${GROUP_SLUG}/all`)
  await waitPastRootSessionLoading(page)
  const summary = page.getByTestId('task-activity-card')
  await expect(summary).toBeVisible(uiTimeout)
  await expect(summary).toContainText('Today in Tasks')
  await expect(summary).toContainText(title)
  await screenshot(page, 'tasks-daily-summary')
})

test('legacy project: its creator converts it to a space', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'converts the one seeded project, so it runs once')
  const title = 'E2E Legacy Project'

  // The seeded project post still shows as a project, with the pill for its creator
  await page.goto(`/groups/${GROUP_SLUG}/all`)
  await waitPastRootSessionLoading(page)
  const card = page.locator('[data-testid="post-card"]', { hasText: title }).first()
  await expect(card).toBeVisible(uiTimeout)
  const pill = card.getByTestId('convert-project-pill')
  await expect(pill).toBeVisible(uiTimeout)
  await card.scrollIntoViewIfNeeded()
  await screenshot(page, 'project-convert-pill')

  // Converting asks first, then opens the new space
  page.once('dialog', dialog => dialog.accept())
  await pill.click()
  await expect(page).toHaveURL(new RegExp(`/groups/${GROUP_SLUG}/spaces/e2e-legacy-project`), uiTimeout)
  await expect(page.getByText(title).first()).toBeVisible(uiTimeout)
  await page.waitForLoadState('networkidle')
  await screenshot(page, 'project-converted-space')

  // The post stays in the group as a discussion, and is no longer offered for conversion
  await page.goto(`/groups/${GROUP_SLUG}/all`)
  await waitPastRootSessionLoading(page)
  const after = page.locator('[data-testid="post-card"]', { hasText: title }).first()
  await expect(after).toBeVisible(uiTimeout)
  await expect(after.getByTestId('convert-project-pill')).toHaveCount(0)
})

test('kanban board: add tasks, drag one to another column, complete one, and edit columns', async ({ page }) => {
  const stamp = Date.now()
  const first = `Board task A ${stamp}`
  const second = `Board task B ${stamp}`

  // The Tasks view opens as a board with the default columns
  await page.goto(`/groups/${GROUP_SLUG}/tasks`)
  await waitPastRootSessionLoading(page)
  const board = page.getByTestId('task-board')
  await expect(board).toBeVisible(uiTimeout)
  const column = name => board.locator(`[data-testid="task-column"][data-column-name="${name}"]`)
  for (const name of ['To do', 'In progress', 'Ready for review', 'Complete']) {
    await expect(column(name)).toBeVisible(uiTimeout)
  }

  // Add two tasks to "To do" with just a title each
  await column('To do').getByTestId('task-column-add').click()
  const addInput = column('To do').getByTestId('task-column-add-input')
  await addInput.fill(first)
  await addInput.press('Enter')
  await expect(column('To do').locator(`[data-task-title="${first}"]`)).toBeVisible(uiTimeout)
  await addInput.fill(second)
  await addInput.press('Enter')
  await expect(column('To do').locator(`[data-task-title="${second}"]`)).toBeVisible(uiTimeout)

  // Drag the first task into "In progress"
  const card = board.locator(`[data-task-title="${first}"]`)
  const target = column('In progress')
  const from = await card.boundingBox()
  const to = await target.boundingBox()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 5, { steps: 4 })
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 })
  await page.mouse.up()
  await expect(column('In progress').locator(`[data-task-title="${first}"]`)).toBeVisible(uiTimeout)
  await expect(column('To do').locator(`[data-task-title="${first}"]`)).toHaveCount(0)

  // Complete the second task with its check circle: it moves to "Complete" and progress updates
  await column('To do').locator(`[data-task-title="${second}"]`).getByTestId('task-card-done-toggle').click()
  await expect(column('Complete').locator(`[data-task-title="${second}"]`)).toBeVisible(uiTimeout)
  await expect(board.getByTestId('task-board-progress')).toContainText(/\d+ of \d+ done/)
  await screenshot(page, 'tasks-board')

  // Both moves were saved: they are still there after a reload
  await page.reload()
  await waitPastRootSessionLoading(page)
  await expect(column('In progress').locator(`[data-task-title="${first}"]`)).toBeVisible(uiTimeout)
  await expect(column('Complete').locator(`[data-task-title="${second}"]`)).toBeVisible(uiTimeout)

  // A steward can add a column (it lands before "Complete") and rename it
  await board.getByTestId('task-board-add-column').click()
  await expect(column('New column')).toBeVisible(uiTimeout)
  await column('New column').getByTestId('task-column-name').dblclick()
  const nameInput = board.getByTestId('task-column-name-input')
  const renamed = `Blocked ${stamp}`
  await nameInput.fill(renamed)
  await nameInput.press('Enter')
  await expect(column(renamed)).toBeVisible(uiTimeout)
  const names = await board.getByTestId('task-column').evaluateAll(els => els.map(el => el.getAttribute('data-column-name')))
  expect(names.indexOf(renamed)).toBe(names.indexOf('Complete') - 1)
  await screenshot(page, 'tasks-board-columns')

  // The status shows on the post wherever it is opened
  await column('In progress').locator(`[data-task-title="${first}"]`).click()
  await expect(page.getByTestId('task-status-chip').last()).toHaveText(/In progress/, uiTimeout)

  // Clean up the extra column so reruns start from the default board
  await page.goto(`/groups/${GROUP_SLUG}/tasks`)
  await waitPastRootSessionLoading(page)
  page.once('dialog', dialog => dialog.accept())
  await column(renamed).getByTestId('task-column-menu').click()
  await page.getByTestId('task-column-delete').click()
  await expect(column(renamed)).toHaveCount(0, uiTimeout)
})

test('project space: create one with its own columns and land on its board', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only flow')
  const name = `Project ${Date.now()}`

  // Open the create-space dialog from the group menu and choose the Project type
  await page.goto(`/groups/${GROUP_SLUG}/more-spaces?edit=true`)
  await waitPastRootSessionLoading(page)
  const addToMenu = page.getByRole('button', { name: 'Add to Menu' }).first()
  await addToMenu.scrollIntoViewIfNeeded()
  await expect(addToMenu).toBeVisible(uiTimeout)
  await addToMenu.click()
  await page.getByText('Add Space', { exact: true }).click()
  await expect(page.locator('h2', { hasText: /Create a new space in/ })).toBeVisible(uiTimeout)
  await page.getByTestId('space-type-project').click()

  // The board's starting columns: the default four, with one replaced
  const columnsEditor = page.getByTestId('project-columns')
  await expect(columnsEditor.getByTestId('project-column-row')).toHaveCount(4, uiTimeout)
  await columnsEditor.getByTestId('project-column-remove').nth(2).click()
  await columnsEditor.getByTestId('project-column-add').click()
  await columnsEditor.getByTestId('project-column-name').nth(2).fill('Blocked')
  await page.getByPlaceholder('Space name').fill(name)
  await columnsEditor.scrollIntoViewIfNeeded()
  await screenshot(page, 'project-space-dialog')

  // Publishing lands on the new space's board with those columns
  const publish = page.getByTestId('space-create-publish')
  await expect(publish).toBeEnabled(uiTimeout)
  await publish.click()
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/tasks/, uiTimeout)
  const board = page.getByTestId('task-board')
  await expect(board).toBeVisible(uiTimeout)
  const names = async () => board.getByTestId('task-column').evaluateAll(els => els.map(el => el.getAttribute('data-column-name')))
  await expect.poll(names, uiTimeout).toEqual(['To do', 'In progress', 'Blocked', 'Complete'])
  await expect(board.getByTestId('task-board-members')).toHaveText(/1 member/, uiTimeout)
  await screenshot(page, 'project-space-board')
})
