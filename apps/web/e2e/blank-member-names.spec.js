import { execFileSync } from 'child_process'
import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

const GROUP_SLUG = 'e2e-public-group'
const BLANK_MARKER = 'Issue 874 blank-name member'
// First render can be slow when several browsers hit a cold Vite dev server
const uiTimeout = { timeout: 60000 }

// Members with a null/blank name (left over from before names were validated)
// must sort to the bottom of the member directory rather than the top.
function insertBlankNameMember () {
  const dbUrl = process.env.E2E_DATABASE_URL
  if (!dbUrl || !/test/i.test(dbUrl)) throw new Error('E2E_DATABASE_URL must point at a test database')
  const email = `blank-name-${Date.now()}@hylo.test`
  const sql = `
    WITH u AS (
      INSERT INTO users (email, name, location, active, email_validated, created_at, updated_at)
      VALUES ('${email}', '', '${BLANK_MARKER}', true, true, now(), now())
      RETURNING id
    )
    INSERT INTO group_memberships (group_id, user_id, active, created_at, updated_at, settings)
    SELECT g.id, u.id, true, now(), now(), '{}'::jsonb FROM u, groups g WHERE g.slug = '${GROUP_SLUG}'`
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', sql])
}

test('members with no name sort to the bottom of the directory', async ({ page }) => {
  test.skip(test.info().project.name.includes('mobile'), 'desktop directory layout')
  test.setTimeout(180000)
  insertBlankNameMember()

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/groups/${GROUP_SLUG}/members?s=name`)
  await waitPastRootSessionLoading(page)

  const cards = page.getByTestId('member-card')
  await expect(cards.first()).toBeVisible(uiTimeout)
  await expect(cards.first()).not.toContainText(BLANK_MARKER)
  await expect(cards.last()).toContainText(BLANK_MARKER, uiTimeout)

  // The card grid is masonry, so the list layout shows the order most clearly
  await page.getByRole('button', { name: 'List', exact: true }).click()
  await expect(cards.last()).toContainText(BLANK_MARKER)
  await cards.last().scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'e2e/screenshots/issue-874-members-blank-last.png' })
})

test('profile editor refuses a blank name', async ({ page }) => {
  test.setTimeout(180000)
  await page.goto('/my/edit-profile')
  await waitPastRootSessionLoading(page)

  const nameField = page.locator('#nameField')
  await expect(nameField).toBeVisible(uiTimeout)
  await nameField.fill('   ')

  await expect(page.getByText('Name must not be blank')).toBeVisible()
  const save = page.getByRole('button', { name: /^Save( Changes)?$/ }).filter({ visible: true })
  await expect(save.first()).toBeDisabled()

  await page.screenshot({ path: `e2e/screenshots/issue-874-blank-name-error-${test.info().project.name}.png` })
})
