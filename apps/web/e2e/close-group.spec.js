import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Settings > Close group: hand off, archive (read-only, posting refused) and
 * delete. Each run creates its own group through the API as the signed-in
 * e2e user, so seeded groups are never archived or deleted.
 */

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const uiTimeout = { timeout: 60000 }

test.describe.configure({ timeout: 180000 })

async function graphql (page, query, variables) {
  return page.evaluate(async ({ query, variables }) => {
    const response = await fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    })
    return response.json()
  }, { query, variables })
}

async function createGroup (page) {
  const slug = `close-group-${Date.now().toString(36)}`
  const result = await graphql(page, 'mutation ($data: GroupInput) { createGroup(data: $data) { id slug name } }', {
    data: { name: `Close Group ${slug}`, slug, visibility: 1, accessibility: 1 }
  })
  expect(result.errors).toBeUndefined()
  return result.data.createGroup
}

test.describe('Close group', () => {
  test.beforeAll(() => {
    fs.mkdirSync(screenshotDir, { recursive: true })
  })

  test('offers hand-off, archives read-only and opens again, then deletes', async ({ page }) => {
    await page.goto('/my/groups')
    await waitPastRootSessionLoading(page)
    const group = await createGroup(page)

    await page.goto(`/groups/${group.slug}/settings/delete`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByText(`Close ${group.name}`)).toBeVisible(uiTimeout)
    await expect(page.getByTestId('close-group-hand-off')).toBeVisible()
    await expect(page.getByTestId('close-group-hand-off').getByRole('textbox', { name: "Search this group's members" })).toBeVisible()
    await expect(page.getByText(/cannot be undone/)).toHaveCount(0)
    await page.screenshot({ path: path.resolve(screenshotDir, 'close-group-01-options.png') })

    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Archive group' }).click()
    await expect(page.getByText(`${group.name} is archived.`)).toBeVisible(uiTimeout)

    const refused = await graphql(page, 'mutation ($data: PostInput) { createPost(data: $data) { id } }', {
      data: { title: 'Still here?', type: 'discussion', groupIds: [group.id] }
    })
    expect(refused.errors?.[0]?.message).toContain('This group is archived and read-only')
    await page.screenshot({ path: path.resolve(screenshotDir, 'close-group-02-archived.png') })

    await page.getByRole('button', { name: 'Open group again' }).click()
    await expect(page.getByText(`${group.name} is open again.`)).toBeVisible(uiTimeout)

    const deleteSection = page.getByTestId('close-group-delete')
    await expect(deleteSection.getByRole('button', { name: 'Delete Group' })).toBeEnabled(uiTimeout)
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Hylo staff can restore it for 30 days')
      dialog.accept()
    })
    await deleteSection.getByRole('button', { name: 'Delete Group' }).click()
    await expect(page).not.toHaveURL(new RegExp(`/groups/${group.slug}/settings`), uiTimeout)
  })
})
