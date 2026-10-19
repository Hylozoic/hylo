/**
 * #1675 — long-pressing a reaction on a phone opens a bottom drawer listing who reacted,
 * grouped by emoji. Your own entries say "Tap to remove" and remove that reaction.
 *
 * The signed-in E2E user really reacts on the seeded post; reactions from two other
 * people are added to the post's GraphQL responses so the drawer has something to group.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP = 'e2e-public-group'
// Seeded posts (seed-e2e-baseline.js). Each test reacts on its own post: tests and projects run in parallel.
const POST_IDS = { drawer: '1', phoneScreenshot: '4', desktopScreenshot: '3' }
const OWN_EMOJIS = ['👍', '❤️']

const OTHER_REACTIONS = [
  { id: 'e2e-r1', emojiFull: '👍', user: { id: '900001', name: 'Brendan Watson' } },
  { id: 'e2e-r2', emojiFull: '👍', user: { id: '900002', name: 'Jessy Watson' } },
  { id: 'e2e-r3', emojiFull: '🎉', user: { id: '900001', name: 'Brendan Watson' } }
]

const avatarDataUri = (color, initial) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${color}"/><text x="32" y="42" font-size="28" font-family="sans-serif" text-anchor="middle" fill="white">${initial}</text></svg>`
)

function addReactionsToPost (node, postId) {
  if (Array.isArray(node)) return node.forEach(child => addReactionsToPost(child, postId))
  if (!node || typeof node !== 'object') return
  if (String(node.id) === postId && Array.isArray(node.postReactions)) {
    node.postReactions = [...node.postReactions.filter(r => !String(r.id).startsWith('e2e-')), ...OTHER_REACTIONS]
  }
  Object.values(node).forEach(child => addReactionsToPost(child, postId))
}

async function routeGraphql (page, postId, { stubAvatars = false } = {}) {
  await page.route('**/noo/graphql', async route => {
    const body = route.request().postData() || ''
    if (stubAvatars && body.includes('ReactorAvatars')) {
      const { variables } = JSON.parse(body)
      const colors = { 900001: '#d97706', 900002: '#2563eb' }
      const data = Object.fromEntries(Object.entries(variables).map(([key, id]) => [
        key.replace('id', 'p'),
        { id, avatarUrl: avatarDataUri(colors[id] || '#16a34a', id === '900001' ? 'B' : 'J') }
      ]))
      return route.fulfill({ json: { data } })
    }
    const response = await route.fetch()
    let json
    try { json = await response.json() } catch (e) { return route.fulfill({ response }) }
    addReactionsToPost(json, postId)
    return route.fulfill({ response, json })
  })
}

async function graphql (page, query, variables) {
  return page.evaluate(async ({ query, variables }) => {
    const res = await fetch('/noo/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    })
    return res.json()
  }, { query, variables })
}

const setOwnReaction = (page, postId, emojiFull, on) => graphql(page,
  `mutation ($entityId: ID, $data: ReactionInput) { ${on ? 'reactOn' : 'deleteReaction'}(entityId: $entityId, data: $data) { id } }`,
  { entityId: postId, data: { emojiFull, entityType: 'post' } }
)

async function openPostWithReactions (page, postId, ownEmojis, options) {
  await routeGraphql(page, postId, options)
  // Post 1 is in the public group; the others are opened by their global URL
  await page.goto(postId === POST_IDS.drawer ? `/groups/${GROUP}/post/${postId}` : `/post/${postId}`)
  await waitPastRootSessionLoading(page)
  for (const emoji of OWN_EMOJIS) await setOwnReaction(page, postId, emoji, false)
  for (const emoji of ownEmojis) await setOwnReaction(page, postId, emoji, true)
  await page.reload()
  await waitPastRootSessionLoading(page)
  const pill = page.locator('[data-testid="emoji-pill"][data-emoji="👍"]').first()
  await expect(pill).toBeVisible({ timeout: 60000 })
  return pill
}

async function touchTap (page, point) {
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await page.waitForTimeout(80)
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
}

async function longPress (page, locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await page.waitForTimeout(800)
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
}

test.use({ storageState: 'e2e/.auth/session.json' })
test.setTimeout(240000)

test.describe('reactions drawer', () => {
  test.afterEach(async ({ page }) => {
    for (const postId of Object.values(POST_IDS)) {
      for (const emoji of OWN_EMOJIS) await setOwnReaction(page, postId, emoji, false).catch(() => {})
    }
  })

  test('long-press a reaction opens the drawer; tapping your own entry removes it', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chrome', 'touch long-press is a phone gesture')
    const pill = await openPostWithReactions(page, POST_IDS.drawer, ['👍'])
    await expect(pill).toContainText('3')

    const drawer = page.getByTestId('reactions-drawer')

    await longPress(page, pill.locator('span.text-inherit'))
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('tab', { name: /👍/ })).toHaveAttribute('aria-selected', 'true')
    await expect(drawer.getByRole('tab')).toHaveText([/All\s*4/, /👍\s*3/, /🎉\s*1/])

    const rows = drawer.getByTestId('reactions-drawer-row')
    await expect(rows).toHaveCount(3)
    await expect(rows.first()).toContainText('You')
    await expect(rows.first()).toContainText('Tap to remove')
    await expect(rows.nth(1).getByRole('link')).toHaveAttribute('href', `/groups/${GROUP}/members/900001`)

    // "All" lists every reaction
    await drawer.getByRole('tab', { name: /All/ }).tap()
    await expect(rows).toHaveCount(4)

    // Tapping your own entry removes that reaction everywhere
    await drawer.getByRole('button', { name: /Tap to remove/ }).tap()
    await expect(rows).toHaveCount(3)
    await expect(drawer.getByText('Tap to remove')).toHaveCount(0)
    await expect(drawer.getByRole('tab').first()).toHaveText(/All\s*3/)

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(pill).toContainText('2')

    // Tapping the dimmed page outside the drawer closes it — and doesn't reach what's underneath.
    // Tap right on the 👍 pill behind the overlay: a tap-through would add your 👍 back.
    await longPress(page, pill.locator('span.text-inherit'))
    await expect(drawer).toBeVisible()
    await page.waitForTimeout(400) // let the open animation finish
    const drawerBox = await drawer.boundingBox()
    const pillBox = await pill.boundingBox()
    const outside = pillBox.y + pillBox.height / 2 < drawerBox.y - 4
      ? { x: pillBox.x + pillBox.width / 2, y: pillBox.y + pillBox.height / 2 }
      : { x: drawerBox.x + drawerBox.width / 2, y: drawerBox.y / 2 }
    const urlBefore = page.url()
    await touchTap(page, outside)
    await expect(drawer).toBeHidden()
    await page.waitForTimeout(500)
    expect(page.url()).toBe(urlBefore)
    await expect(pill).toContainText('2')

    // The removal reached the server
    const result = await graphql(page, `query { post(id: "${POST_IDS.drawer}") { myReactions { emojiFull } } }`)
    expect(result.data.post.myReactions.map(r => r.emojiFull)).not.toContain('👍')
  })

  test('capture screenshot reactions drawer on a phone, light and dark', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chrome', 'phone screenshot')
    fs.mkdirSync(screenshotDir, { recursive: true })
    const pill = await openPostWithReactions(page, POST_IDS.phoneScreenshot, OWN_EMOJIS, { stubAvatars: true })

    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme })
      await longPress(page, pill.locator('span.text-inherit'))
      const drawer = page.getByTestId('reactions-drawer')
      await expect(drawer).toBeVisible()
      await drawer.getByRole('tab', { name: /All/ }).tap()
      await expect(drawer.getByTestId('reactions-drawer-row')).toHaveCount(5)
      await page.waitForTimeout(400)
      await page.screenshot({ path: path.resolve(screenshotDir, `issue-1675-drawer-all-${scheme}.png`) })
      await drawer.getByRole('tab', { name: /👍/ }).tap()
      await page.waitForTimeout(200)
      await page.screenshot({ path: path.resolve(screenshotDir, `issue-1675-drawer-thumbs-${scheme}.png`) })
      await page.keyboard.press('Escape')
      await expect(drawer).toBeHidden()
    }
  })

  test('capture screenshot desktop hover tooltip is unchanged', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'desktop screenshot')
    fs.mkdirSync(screenshotDir, { recursive: true })
    const pill = await openPostWithReactions(page, POST_IDS.desktopScreenshot, ['👍'])
    await pill.locator('span.text-inherit').hover()
    await expect(page.getByRole('tooltip').filter({ hasText: 'Brendan Watson' })).toBeVisible()
    await page.waitForTimeout(300)
    const box = await pill.boundingBox()
    await page.screenshot({
      path: path.resolve(screenshotDir, 'issue-1675-desktop-hover.png'),
      clip: { x: Math.max(0, box.x - 200), y: Math.max(0, box.y - 160), width: 600, height: 260 }
    })
    await expect(page.getByTestId('reactions-drawer')).toHaveCount(0)
  })
})
