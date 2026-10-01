import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * The create-group form: nothing is preselected for who can see or join the
 * group, Create stays disabled with a note naming what is missing, and with
 * member invitations on, "Who can add new members?" starts on Everyone and
 * offers Stewards (Administrators, Moderators and Hosts).
 * The isolated runner turns member invites on (FEATURE_FLAG_MEMBER_INVITES /
 * VITE_FEATURE_FLAG_MEMBER_INVITES).
 */

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const uiTimeout = { timeout: 60000 }

test.describe.configure({ timeout: 120000 })

async function openCreateGroup (page) {
  await page.goto('/public/all?create=group')
  await expect(page.locator('#center-column-container')).toBeVisible(uiTimeout)
  const dialog = page.getByRole('dialog', { name: 'Create a group' })
  await expect(dialog).toBeVisible(uiTimeout)
  return dialog
}

test.describe('Creating a group', () => {
  test.beforeAll(() => {
    fs.mkdirSync(screenshotDir, { recursive: true })
  })

  test('keeps Create disabled until visibility and joining are both chosen', async ({ page }) => {
    const dialog = await openCreateGroup(page)
    await dialog.locator('#groupName').fill(`Seed Library ${Date.now().toString(36)}`)

    const submit = dialog.getByRole('button', { name: /Create Group/i })
    const missing = dialog.getByTestId('create-group-missing-choices')
    await expect(dialog.getByRole('button', { name: 'Who can see this group?' })).toContainText('Choose who can see it')
    await expect(dialog.getByRole('button', { name: 'Who can join this group?' })).toContainText('Choose how people join')
    await expect(missing).toHaveText('Choose who can see this group and who can join it.')
    await expect(submit).toBeDisabled()
    await page.screenshot({ path: path.resolve(screenshotDir, `${test.info().project.name}-create-group-policy-01-unselected.png`) })

    await dialog.getByRole('button', { name: 'Who can see this group?' }).click()
    await expect(page.getByText('This group will be exposed to search engines.')).toBeVisible()
    await page.getByRole('button', { name: /^Anyone can find and see/ }).click()
    await expect(missing).toHaveText('Choose who can join this group.')
    await expect(dialog.getByTestId('public-group-review-note')).toHaveText('Public groups are reviewed before they appear in the Group Explorer.')
    await expect(submit).toBeDisabled()

    await dialog.getByRole('button', { name: 'Who can join this group?' }).click()
    await page.getByRole('button', { name: /^By request, with approval/ }).click()
    await expect(missing).toHaveCount(0)
    await expect(submit).toBeEnabled()
    await page.screenshot({ path: path.resolve(screenshotDir, `${test.info().project.name}-create-group-policy-02-chosen.png`) })
  })

  test('starts "Who can add new members?" on Everyone and offers Stewards, but not specific roles', async ({ page }) => {
    const dialog = await openCreateGroup(page)
    const policy = dialog.getByRole('button', { name: 'Who can add new members?' })
    await expect(policy).toContainText('Everyone in the group')

    await policy.click()
    await expect(page.getByRole('button', { name: 'Specific roles' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Stewards (Administrators, Moderators and Hosts)' }).click()
    await expect(policy).toContainText('Stewards (Administrators, Moderators and Hosts)')
    await expect(dialog.getByText('Administrators, Moderators and Hosts can invite people.', { exact: true })).toBeVisible()
    await page.screenshot({ path: path.resolve(screenshotDir, `${test.info().project.name}-create-group-policy-03-stewards.png`) })
  })
})
