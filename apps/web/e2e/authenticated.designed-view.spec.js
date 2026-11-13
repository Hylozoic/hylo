import { test, expect } from '@playwright/test'
import { execFileSync } from 'child_process'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { canSeedHyloPro, grantHyloPro, revokeHyloPro } from './helpers/hyloProGrant.js'

/**
 * "Design your own view" in a real logged-in session: the chat column replaces
 * the group menu, a message redraws the page in the main column, and saving
 * adds the page to the group's menu for real (createGroupView is not stubbed).
 * Only the AI turn is stubbed, so no model runs.
 * Requires the E2E seed's Administrator role for the login user on e2e-public-group.
 */

test.describe.configure({ timeout: 180000, mode: 'serial' })

const GROUP_SLUG = 'e2e-public-group'
const PRO_NOTE = 'e2e designed view spec'
const VIEW_NAME = 'E2E Start Here'
const uiTimeout = { timeout: 60000 }

// Stands in for an uploaded image; the spec serves a picture at this address
const HERO_IMAGE = 'https://uploads.e2e-hylo.test/garden.svg'
const HERO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6b4f"/><stop offset="1" stop-color="#e0a030"/></linearGradient></defs><rect width="1600" height="600" fill="url(#g)"/><circle cx="1250" cy="170" r="90" fill="#f6e7b0"/></svg>'

const turn = {
  reply: 'I made a welcome page with the latest posts and the members.',
  view: {
    version: 1,
    blocks: [
      { type: 'hero', imageUrl: HERO_IMAGE, title: 'Welcome to the group', subtitle: 'Start here', height: 'medium', align: 'left' },
      { type: 'text', text: 'This is where new members start.' },
      { type: 'callout', title: 'Say hello', text: 'Introduce yourself in a post.', tone: 'accent' },
      {
        type: 'columns',
        columns: [
          [{ type: 'posts', title: 'Latest posts', postTypes: [], limit: 5, layout: 'list' }],
          [{ type: 'members', title: 'Members', limit: 6 }]
        ]
      },
      { type: 'button', label: 'See all members', destination: 'members' }
    ]
  },
  usage: {
    model: 'claude-opus-5-5',
    inputTokens: 4411,
    outputTokens: 551,
    estimatedCostUsd: 0.028664,
    pricePerMillionTokens: { input: 4, output: 20 }
  }
}

function sql (query) {
  return execFileSync('psql', [process.env.E2E_DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' }).trim()
}

const deleteTestViews = () => sql(`DELETE FROM group_views WHERE type = 'designed' AND name = '${VIEW_NAME}'`)

test.describe('designed views', () => {
  test.skip(({ isMobile }) => isMobile, 'The designer is a desktop layout for now')
  test.skip(!canSeedHyloPro, 'needs E2E_DATABASE_URL to give the group Hylo Pro')

  test.beforeAll(() => {
    if (!canSeedHyloPro) return
    deleteTestViews()
    grantHyloPro(GROUP_SLUG, PRO_NOTE)
  })
  test.afterAll(() => {
    if (!canSeedHyloPro) return
    deleteTestViews()
    revokeHyloPro(PRO_NOTE)
  })

  test('designs a page in the chat, saves it to the menu, and opens it again to edit', async ({ page }) => {
    await page.route('**/noo/graphql', async route => {
      const body = route.request().postData() || ''
      if (!body.includes('DesignGroupViewTurn')) return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { designGroupViewTurn: turn } })
      })
    })

    await page.route('https://uploads.e2e-hylo.test/**', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: HERO_SVG }))

    await page.goto(`/groups/${GROUP_SLUG}/design/new`)
    await waitPastRootSessionLoading(page)

    // The chat column stands in for the group menu
    const chat = page.getByTestId('designer-chat-column')
    await expect(chat).toBeVisible(uiTimeout)
    await expect(chat.getByRole('link', { name: 'Back' })).toBeVisible()
    await expect(page.getByTestId('designer-canvas')).toContainText('Your page will appear here')
    await expect(page.getByTestId('designer-usage')).toContainText('Each message costs about $0.03')
    await expect(chat.getByRole('button', { name: 'Add to menu' })).toBeDisabled()
    await expect(chat.getByRole('button', { name: 'Add image' })).toBeEnabled()

    await chat.getByLabel('Message').fill('A welcome page for new members')
    await chat.getByRole('button', { name: 'Send' }).click()

    // The reply lands in the chat and the page is drawn in the main column
    await expect(chat).toContainText(turn.reply, uiTimeout)
    const canvas = page.getByTestId('designer-canvas')
    await expect(canvas.getByRole('heading', { level: 1, name: 'Welcome to the group' })).toBeVisible()
    await expect(canvas).toContainText('Introduce yourself in a post.')
    // The banner image has loaded and fills the hero
    const heroImage = canvas.locator('[data-block="hero"] img')
    await expect(heroImage).toHaveAttribute('src', HERO_IMAGE)
    await expect.poll(() => heroImage.evaluate(img => img.complete && img.naturalWidth > 0), uiTimeout).toBe(true)
    await expect(canvas.locator('[data-block="members"] a').first()).toBeVisible(uiTimeout)
    await expect(page.getByTestId('designer-usage')).toContainText('Last message: 4,411 input and 551 output tokens, about $0.029')
    await expect(page.getByTestId('designer-usage')).toContainText('Messages in this design: 1, using 4,962 tokens')
    await page.screenshot({ path: 'e2e-screenshots/designed-view-1-designer.png' })

    // Saving adds it to the group's menu
    await chat.getByLabel('Name in the menu').fill(VIEW_NAME)
    await chat.getByRole('button', { name: 'Add to menu' }).click()
    await expect(page).toHaveURL(/\/designed\/\d+/, uiTimeout)
    await expect(page.getByTestId('designer-chat-column')).toHaveCount(0)
    await expect(page.getByTestId('designed-view').getByRole('heading', { level: 1, name: 'Welcome to the group' })).toBeVisible(uiTimeout)
    await expect(page.getByRole('link', { name: VIEW_NAME }).first()).toBeVisible(uiTimeout)
    await page.screenshot({ path: 'e2e-screenshots/designed-view-2-saved.png' })

    // A post in a live list opens in the dialog over the page, as it does in other views
    await page.getByTestId('designed-view').locator('[data-block="posts"] a').first().click()
    await expect(page).toHaveURL(/\/designed\/\d+\/post\/\d+/, uiTimeout)
    await expect(page.getByRole('dialog')).toBeVisible(uiTimeout)
    await expect(page.getByTestId('designed-view')).toBeVisible()
    await page.screenshot({ path: 'e2e-screenshots/designed-view-5-post-dialog.png' })
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/designed\/\d+$/, uiTimeout)

    const stored = JSON.parse(sql(`SELECT settings::text FROM group_views WHERE type = 'designed' AND name = '${VIEW_NAME}'`))
    expect(stored.design.blocks[0]).toEqual({ type: 'hero', imageUrl: HERO_IMAGE, title: 'Welcome to the group', subtitle: 'Start here', height: 'medium', align: 'left' })

    // It survives a reload, and "Edit design" reopens the designer with the saved page
    await page.reload()
    await waitPastRootSessionLoading(page)
    await expect(page.getByTestId('designed-view').getByRole('heading', { level: 1, name: 'Welcome to the group' })).toBeVisible(uiTimeout)
    await page.getByTestId('designed-view-edit').click()
    await expect(page.getByTestId('designer-chat-column')).toBeVisible(uiTimeout)
    await expect(page.getByTestId('designer-chat-column').getByLabel('Name in the menu')).toHaveValue(VIEW_NAME)
    // The images a saved page uses are offered again for further changes
    await expect(page.getByTestId('designer-image')).toHaveCount(1)
    await expect(page.getByTestId('designer-canvas').getByRole('heading', { level: 1, name: 'Welcome to the group' })).toBeVisible()
  })

  test('the Add View dialog leads with "Design your own view" and lists designed views', async ({ page }) => {
    await page.goto(`/groups/${GROUP_SLUG}/all?edit=true`)
    await waitPastRootSessionLoading(page)

    await page.getByRole('button', { name: 'Add to Menu' }).click(uiTimeout)
    await page.getByRole('menuitem', { name: /Add View/ }).click()

    const dialog = page.getByRole('dialog', { name: 'Add View' })
    await expect(dialog.getByTestId('design-your-own-view')).toBeVisible(uiTimeout)
    await expect(dialog.getByTestId('designed-view-row')).toContainText(VIEW_NAME)
    // Designed views come first, then the common and custom views
    const text = await dialog.innerText()
    expect(text.indexOf('Design your own view')).toBeLessThan(text.search(/your designed views/i))
    expect(text.search(/your designed views/i)).toBeLessThan(text.search(/custom views/i))
    await page.screenshot({ path: 'e2e-screenshots/designed-view-4-add-view-dialog.png' })

    await dialog.getByTestId('design-your-own-view').click()
    await expect(page).toHaveURL(/\/design\/new/, uiTimeout)
    await expect(page.getByTestId('designer-chat-column')).toBeVisible(uiTimeout)
  })

  test('without Hylo Pro the chat is closed, and the server refuses a design turn', async ({ page }) => {
    revokeHyloPro(PRO_NOTE)
    await page.goto(`/groups/${GROUP_SLUG}/design/new`)
    await waitPastRootSessionLoading(page)

    const chat = page.getByTestId('designer-chat-column')
    await expect(chat.getByTestId('designer-pro-notice')).toContainText('Designed views are part of Hylo Pro', uiTimeout)
    await expect(chat.getByLabel('Message')).toBeDisabled()
    await page.screenshot({ path: 'e2e-screenshots/designed-view-3-without-pro.png' })

    const refused = await page.evaluate(async slug => {
      const post = body => fetch('/noo/graphql', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
      }).then(res => res.json())
      const { data } = await post({ query: 'query ($slug: String) { group(slug: $slug) { id } }', variables: { slug } })
      return post({
        query: 'mutation ($groupId: ID!, $messages: JSON!) { designGroupViewTurn(groupId: $groupId, messages: $messages) }',
        variables: { groupId: data.group.id, messages: [{ role: 'user', text: 'A welcome page' }] }
      })
    }, GROUP_SLUG)
    expect(refused.errors?.[0]?.message).toContain('part of Hylo Pro')
  })
})
