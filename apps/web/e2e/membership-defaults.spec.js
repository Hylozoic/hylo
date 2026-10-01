import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * D1 and D11: a steward sets the post notifications new members start with, and a
 * member whose email from the group is off sees that said on the About page, with a
 * link to change it. Joining with a saved 'less email' choice is covered by the backend
 * tests (Group.membershipDefaults, User.joinGroup) and the GroupWelcomeModal test.
 * Requires the E2E seed: e2e.user is an Administrator of e2e-public-group.
 * Screenshots go to e2e/screenshots.
 */

test.use({ storageState: 'e2e/.auth/session.json' })
test.describe.configure({ timeout: 180000, mode: 'serial' })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP = 'e2e-public-group'

const NEW_MEMBER_LABEL = 'When a new member joins this group, they are notified about:'
const IMPORTANT = 'Important Posts (Announcements, Mentions & Replies)'
const EVERY_POST = 'Every Post'

async function capture (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({ path: path.resolve(screenshotDir, `membership-defaults-${name}.png`), animations: 'disabled' })
}

async function openSettings (page) {
  await page.goto(`/groups/${GROUP}/settings`)
  await waitPastRootSessionLoading(page)
  await expect(page).toHaveURL(new RegExp(`/groups/${GROUP}/settings/?$`), navTimeout)
  await expect(page.getByText(NEW_MEMBER_LABEL)).toBeVisible(uiTimeout)
}

async function chooseDefault (page, from, to) {
  await page.getByText(from, { exact: true }).first().click()
  await page.getByText(to, { exact: true }).last().click()
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Current settings up to date')).toBeVisible(uiTimeout)
}

test('a steward sets the post notifications new members start with', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only screenshots')

  await openSettings(page)
  const row = page.getByText(NEW_MEMBER_LABEL)
  await row.scrollIntoViewIfNeeded()
  const current = await page.getByText(EVERY_POST, { exact: true }).isVisible() ? EVERY_POST : IMPORTANT
  await capture(page, 'settings-before')

  const next = current === IMPORTANT ? EVERY_POST : IMPORTANT
  await chooseDefault(page, current, next)
  await openSettings(page)
  await expect(page.getByText(next, { exact: true }).first()).toBeVisible(uiTimeout)
  await capture(page, 'settings-after')

  // Put it back for other specs
  await chooseDefault(page, next, current)
})

test('the About page says when email from the group is off, with a link to change it', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only screenshots')

  await page.goto(`/groups/${GROUP}/about`)
  await waitPastRootSessionLoading(page)
  await expect(page.locator('#center-column')).toBeVisible(uiTimeout)

  const emailSwitch = page.locator('[id$="-email-notifications"]').first()
  await expect(emailSwitch).toBeVisible(uiTimeout)
  const wasOn = (await emailSwitch.getAttribute('aria-checked')) === 'true'
  if (wasOn) await emailSwitch.click()

  const notice = page.getByTestId('email-off-notice')
  await expect(notice).toContainText('Email from this group is off.', uiTimeout)
  await expect(notice.getByRole('link', { name: 'Change email settings' })).toHaveAttribute('href', '/my/notifications')
  await notice.scrollIntoViewIfNeeded()
  await capture(page, 'about-email-off')

  if (wasOn) {
    await emailSwitch.click()
    await expect(notice).toHaveCount(0, uiTimeout)
  }
})
