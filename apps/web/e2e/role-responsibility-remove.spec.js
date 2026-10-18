import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Issue #1673 — removing a responsibility from a custom role (Group Settings → Roles & Badges).
 * Creates a custom role, adds responsibilities through the UI, removes them through the
 * Remove button + confirm dialog, then reloads and checks what the backend has.
 */

test.describe.configure({ timeout: 180000 })

const GROUP_SLUG = 'e2e-public-group'
const uiTimeout = { timeout: 60000 }
const shotDir = process.env.E2E_SCREENSHOT_DIR || 'test-results'

async function gql (page, query, variables) {
  return page.evaluate(async ({ query, variables }) => {
    const res = await fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    })
    return res.json()
  }, { query, variables })
}

async function roleResponsibilityTitles (page, roleId) {
  const json = await gql(page, 'query ($groupRoleId: ID) { responsibilities (groupRoleId: $groupRoleId) { id title responsibilityId } }', { groupRoleId: roleId })
  return (json.data?.responsibilities || []).map(r => r.title).sort()
}

function roleCard (page, roleName) {
  return page.locator('div.relative.rounded-lg').filter({ has: page.locator(`input[value="${roleName}"]`) }).first()
}

async function addResponsibilityViaUI (page, roleName, title) {
  const card = roleCard(page, roleName)
  await card.getByText('+ Add Responsibility to Role').click()
  await card.locator('li a', { hasText: new RegExp(`^${title}$`) }).click()
  await expect(card.locator('div.bg-card span', { hasText: new RegExp(`^${title}$`) })).toBeVisible(uiTimeout)
}

async function removeResponsibilityViaUI (page, roleName, title) {
  const card = roleCard(page, roleName)
  const row = card.locator('div.bg-card').filter({ has: page.locator('span', { hasText: new RegExp(`^${title}$`) }) })
  page.once('dialog', dialog => dialog.accept())
  await row.getByText('Remove', { exact: true }).click()
}

test('custom role shows only its own responsibilities and removing one persists (#1673)', async ({ page }) => {
  const removeCalls = []
  page.on('response', async response => {
    if (!response.url().includes('/noo/graphql')) return
    const body = response.request().postData() || ''
    if (!body.includes('removeResponsibilityFromRole')) return
    let json = null
    try { json = await response.json() } catch (e) {}
    removeCalls.push({ variables: JSON.parse(body).variables, response: json })
  })

  await page.goto(`/groups/${GROUP_SLUG}/settings/roles`)
  await waitPastRootSessionLoading(page)

  const groupJson = await gql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: GROUP_SLUG })
  const groupId = groupJson.data.group.id
  const roleName = `Organizer ${Date.now()}`
  const created = await gql(page,
    'mutation ($groupId: ID, $name: String, $description: String, $emoji: String) { addGroupRole (groupId: $groupId, name: $name, description: $description, emoji: $emoji) { id } }',
    { groupId, name: roleName, description: 'Custom role for #1673', emoji: '✨' })
  const roleId = created.data.addGroupRole.id

  await page.reload()
  await waitPastRootSessionLoading(page)
  const card = roleCard(page, roleName)
  await expect(card.getByText('+ Add Responsibility to Role')).toBeVisible(uiTimeout)
  // A brand new role has no responsibilities (previously every role listed all system responsibilities)
  await expect(card.locator('div.bg-card')).toHaveCount(0)

  await addResponsibilityViaUI(page, roleName, 'Add Members')
  await addResponsibilityViaUI(page, roleName, 'Manage Content')
  expect(await roleResponsibilityTitles(page, roleId)).toEqual(['Add Members', 'Manage Content'])

  await page.reload()
  await waitPastRootSessionLoading(page)
  await expect(card.locator('div.bg-card span:not(.border-2)')).toHaveText(['Add Members', 'Manage Content'], uiTimeout)
  await card.screenshot({ path: `${shotDir}/issue-1673-after-1-role-loaded.png` })

  await removeResponsibilityViaUI(page, roleName, 'Manage Content')
  await expect(card.locator('div.bg-card span:not(.border-2)')).toHaveText(['Add Members'], uiTimeout)
  await card.screenshot({ path: `${shotDir}/issue-1673-after-2-removed.png` })

  expect(removeCalls).toHaveLength(1)
  expect(removeCalls[0].response.errors).toBeUndefined()
  expect(removeCalls[0].response.data.removeResponsibilityFromRole.success).toBe(true)

  await page.reload()
  await waitPastRootSessionLoading(page)
  await expect(card.locator('div.bg-card span:not(.border-2)')).toHaveText(['Add Members'], uiTimeout)
  expect(await roleResponsibilityTitles(page, roleId)).toEqual(['Add Members'])
  await card.screenshot({ path: `${shotDir}/issue-1673-after-3-reloaded.png` })

  // Removing must not touch the Administrator role's responsibilities
  const adminRole = await gql(page, 'query ($slug: String) { group(slug: $slug) { groupRoles { items { id name } } } }', { slug: GROUP_SLUG })
  const administrator = adminRole.data.group.groupRoles.items.find(r => r.name === 'Administrator')
  expect(await roleResponsibilityTitles(page, administrator.id)).toContain('Administration')
})
