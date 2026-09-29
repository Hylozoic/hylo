import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Cold-open landing, the What's new divider, tours in the card-menu and
 * top-bar layouts, and the Building Hylo help link.
 *
 * The seeded E2E user (id 1) belongs to several groups, so a cold open lands
 * on What's new (All My Groups). `e2e-one-column-group` uses the card menu.
 * The top-bar layout is switched on for this page only, by editing the
 * MeQuery response, so the shared test account's settings never change.
 */

test.describe.configure({ timeout: 120000 })
test.skip(({ isMobile }) => isMobile, 'The top bar and the side rail are desktop layouts')

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }
const E2E_USER_ID = '1'
const ONE_COLUMN_GROUP = 'e2e-one-column-group'

async function graphql (page, query, variables = {}) {
  return page.evaluate(async ({ query, variables }) => {
    const response = await fetch('/noo/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    })
    return response.json()
  }, { query, variables })
}

async function useTopBarLayout (page) {
  await page.route('**/noo/graphql', async route => {
    const body = route.request().postData() || ''
    if (!body.includes('MeQuery')) return route.continue()
    const response = await route.fetch()
    const json = await response.json()
    if (json?.data?.me?.settings) json.data.me.settings.globalNavStyle = 'tabs'
    return route.fulfill({ response, json })
  })
}

async function openTour (page, tourName) {
  await page.getByRole('button', { name: 'Help' }).first().click()
  await page.getByTestId('take-a-tour').click()
  // A pattern can name more than one tour; take the first one this view offers
  const item = page.getByRole('menuitem', { name: tourName, disabled: false }).first()
  await expect(item).toBeVisible(uiTimeout)
  await item.click()
  await expect(page.locator('.driver-popover')).toBeVisible(uiTimeout)
}

test.describe('cold-open landing', () => {
  test('someone in 3+ groups lands on What\'s new with a divider at their last visit', async ({ page }) => {
    // A post made now, and a last visit just before it, so exactly the new
    // post sits above the divider
    await page.goto('/all/all')
    await waitPastRootSessionLoading(page)
    const groups = await graphql(page, '{ me { memberships { group { id type } } } }')
    const groupId = groups?.data?.me?.memberships?.map(m => m.group).find(g => g.type !== 'space')?.id
    test.skip(!groupId, 'The seeded user has no group to post in')
    const created = await graphql(page, 'mutation ($data: PostInput) { createPost(data: $data) { id createdAt } }', {
      data: { title: `What's new check ${Date.now()}`, type: 'discussion', groupIds: [groupId] }
    })
    const createdAt = created?.data?.createPost?.createdAt
    test.skip(!createdAt, 'Could not create a post for the check')
    const lastVisit = new Date(createdAt).getTime() - 1

    await page.evaluate(({ userId, lastVisit }) => {
      window.sessionStorage.setItem(`hylo-visit-baseline:${userId}`, String(lastVisit))
      window.localStorage.setItem(`hylo-last-seen:${userId}`, String(Date.now()))
    }, { userId: E2E_USER_ID, lastVisit })

    await page.goto('/')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/all\/all/, navTimeout)
    await expect(page.getByTestId('new-since-divider')).toBeVisible(uiTimeout)
  })
})

test.describe('tours in every layout', () => {
  test('the card menu offers the group tour', async ({ page }) => {
    await page.goto(`/groups/${ONE_COLUMN_GROUP}`)
    await waitPastRootSessionLoading(page)
    await expect(page.locator('[data-tour-layout="grid"]')).toBeVisible(navTimeout)
    await expect(page.locator('[data-tour="group-menu"]')).toBeVisible(uiTimeout)
    await openTour(page, /Explore a group|Set up your group/)
  })

  test('the top bar offers the getting-around tour', async ({ page }) => {
    await useTopBarLayout(page)
    await page.goto('/all/all')
    await waitPastRootSessionLoading(page)
    await expect(page.locator('[data-tour-layout="tabs"]')).toBeVisible(navTimeout)
    await openTour(page, 'Getting around Hylo')
    await expect(page.locator('.driver-popover-title')).toHaveText('My Home', uiTimeout)
  })
})

test.describe('help', () => {
  test('both help menus offer Join Building Hylo', async ({ page }) => {
    await page.goto('/all/all')
    await waitPastRootSessionLoading(page)
    await page.getByRole('button', { name: 'Help' }).first().click()
    await expect(page.getByRole('menuitem', { name: 'Join Building Hylo' })).toHaveAttribute('href', '/groups/building-hylo/about', uiTimeout)
    await page.keyboard.press('Escape')

    await useTopBarLayout(page)
    await page.goto('/all/all')
    await waitPastRootSessionLoading(page)
    await expect(page.locator('[data-tour-layout="tabs"]')).toBeVisible(navTimeout)
    await page.getByRole('button', { name: 'Help' }).first().click()
    await expect(page.getByRole('menuitem', { name: 'Join Building Hylo' })).toBeVisible(uiTimeout)
  })
})
