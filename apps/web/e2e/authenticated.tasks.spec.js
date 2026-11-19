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
