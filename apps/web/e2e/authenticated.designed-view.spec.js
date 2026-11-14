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
  name: 'Welcome Page',
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

const suggestions = {
  reply: 'Requests are piling up and newcomers have no starting point.',
  suggestions: [
    { name: 'Start Here', why: 'The group has no description, so new members have nothing to orient them.', prompt: 'A welcome page for new members' },
    { name: 'Lend a Hand', why: 'Nine requests are open against three offers.', prompt: 'A page that shows open requests first.' }
  ],
  usage: { model: 'claude-opus-5-5', inputTokens: 1507, outputTokens: 1411, estimatedCostUsd: 0.034248, pricePerMillionTokens: { input: 4, output: 20 } }
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
      if (body.includes('SuggestGroupViews')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { suggestGroupViews: suggestions } }) })
      }
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
    // Axl greets the steward and offers to look at the group
    await expect(chat.locator('[data-role="assistant"]').first()).toContainText('Hey there! What do you want to build today?')
    await expect(chat.locator('[data-role="assistant"]').first()).toContainText('Axl')
    await expect(chat.getByRole('button', { name: 'Make some suggestions' })).toBeVisible()
    // Before anything is designed, the main column asks what to build, centred in the space
    const empty = page.getByTestId('designer-empty')
    await expect(empty).toContainText('What do you want to build?')
    await expect(empty).toContainText('Describe what you need in the chat')
    const emptyBox = await empty.locator('h2').boundingBox()
    const viewportSize = page.viewportSize()
    expect(Math.abs((emptyBox.y + emptyBox.height / 2) - viewportSize.height / 2)).toBeLessThan(viewportSize.height * 0.15)
    // The running cost starts at nothing
    await expect(page.getByTestId('designer-usage')).toHaveText('$0.00')
    await expect(page.getByTestId('designer-save')).toBeDisabled()
    // The + offers an image or a PDF for Axl to read
    await chat.getByTestId('designer-add-attachment').click()
    await expect(page.getByTestId('designer-add-image')).toBeVisible()
    await expect(page.getByTestId('designer-add-document')).toBeVisible()
    await expect(page.getByTestId('designer-add-post')).toBeVisible()
    await expect(page.getByText('Files are sent to the AI to be read.')).toBeVisible()
    await page.keyboard.press('Escape')
    // "Add to menu" sits at the right of the main column's header, not in the chat
    const saveBox = await page.getByTestId('designer-save').boundingBox()
    const chatBox = await chat.boundingBox()
    expect(saveBox.x).toBeGreaterThan(chatBox.x + chatBox.width)
    expect(saveBox.y).toBeLessThan(60)

    // The message box starts one line tall with its text level with the buttons, and grows with a long message
    const message = chat.getByRole('textbox', { name: 'Message' })
    const oneLine = await message.boundingBox()
    const plus = await chat.getByTestId('designer-add-attachment').boundingBox()
    expect(Math.abs((oneLine.y + oneLine.height / 2) - (plus.y + plus.height / 2))).toBeLessThanOrEqual(3)
    await message.fill(Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join('\n'))
    const grown = await message.boundingBox()
    // 12 lines of 20px plus the box's own padding
    expect(Math.round((grown.height - 16) / 20)).toBe(12)
    await message.fill('')

    // "Make some suggestions" offers pages that fit the group; picking one starts the design and names it
    await chat.getByTestId('designer-suggest-views').click()
    await expect(chat.getByTestId('designer-suggestion')).toHaveCount(2, uiTimeout)
    await expect(chat.getByTestId('designer-suggestions')).toContainText('Requests are piling up')
    await expect(page.getByTestId('designer-usage')).toHaveText('$0.03')
    await page.screenshot({ path: 'e2e-screenshots/designed-view-0-suggestions.png' })
    await chat.getByTestId('designer-suggestion').first().getByRole('button', { name: 'Design this' }).click()
    // The suggestion's name is kept; the name the AI offers with the design does not replace it
    await expect(page.getByTestId('designer-view-name')).toHaveText('Start Here')

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
    // The suggestion call and the design turn add up in the pill; the detail is in its tooltip
    await expect(page.getByTestId('designer-usage')).toHaveText('$0.06')
    await expect(page.getByTestId('designer-usage')).toHaveAttribute('title', /Messages in this design: 2, using 7,880 tokens/)
    await page.screenshot({ path: 'e2e-screenshots/designed-view-1-designer.png' })

    await expect(page.getByTestId('designer-view-name')).toHaveText('Start Here')

    // Clicking the name in the main column renames the view
    await page.getByTestId('designer-view-name').click()
    await page.getByTestId('designer-view-name-input').fill(VIEW_NAME)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('designer-view-name')).toHaveText(VIEW_NAME)

    // Until it is saved the view is a draft, shown as a pill after its name
    await expect(page.getByTestId('designer-status')).toHaveText('Draft')

    // Saving adds it to the group's menu
    await page.getByTestId('designer-save').click()
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
    await expect(page.getByTestId('designer-view-name')).toHaveText(VIEW_NAME)
    // A saved view that has not been changed is published
    await expect(page.getByTestId('designer-status')).toHaveText('Published')
    // The images a saved page uses are offered again for further changes
    await expect(page.getByTestId('designer-image')).toHaveCount(1)
    await expect(page.getByTestId('designer-canvas').getByRole('heading', { level: 1, name: 'Welcome to the group' })).toBeVisible()
  })

  test('draws an infinite canvas that can be zoomed and dragged', async ({ page }) => {
    const canvasTurn = {
      reply: 'I made a canvas with a region for each kind of activity.',
      name: 'Group at a Glance',
      view: {
        version: 1,
        blocks: [
          {
            type: 'canvas',
            regions: [
              { title: 'Latest posts', note: 'Everything new', tone: 'accent', col: 0, row: 0, blocks: [{ type: 'posts', postTypes: [], limit: 4, layout: 'list' }] },
              { title: 'Public', tone: 'plain', col: 1, row: 0, blocks: [{ type: 'posts', postTypes: [], search: 'public', limit: 4, layout: 'list' }] },
              { title: 'People', tone: 'muted', col: 2, row: 0, blocks: [{ type: 'members', limit: 6 }] },
              { title: 'Coming up', tone: 'primary', col: 0, row: 1, blocks: [{ type: 'events', limit: 3 }, { type: 'button', label: 'All events', destination: 'events' }] }
            ]
          }
        ]
      },
      usage: turn.usage
    }
    await page.route('**/noo/graphql', async route => {
      const body = route.request().postData() || ''
      if (!body.includes('DesignGroupViewTurn')) return route.continue()
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { designGroupViewTurn: canvasTurn } }) })
    })

    await page.goto(`/groups/${GROUP_SLUG}/design/new`)
    await waitPastRootSessionLoading(page)
    const chat = page.getByTestId('designer-chat-column')
    await expect(chat).toBeVisible(uiTimeout)
    await chat.getByRole('textbox', { name: 'Message' }).fill('Make an infinite canvas of everything in the group')
    await chat.getByRole('button', { name: 'Send' }).click()

    const canvas = page.getByTestId('designer-canvas')
    await expect(canvas.getByTestId('designed-canvas-region')).toHaveCount(4, uiTimeout)
    // With no name of the steward's own, the first design names the view
    await expect(page.getByTestId('designer-view-name')).toHaveText('Group at a Glance')
    // The whole name fits in the header
    expect(await page.getByTestId('designer-view-name').locator('span').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await expect(page.getByTestId('designer-save')).toBeEnabled()
    await expect(canvas.locator('[data-block="members"] a').first()).toBeVisible(uiTimeout)
    // The search-filtered region only lists posts that mention the word
    const searched = canvas.getByTestId('designed-canvas-region').nth(1)
    await expect(searched.locator('a').first()).toContainText(/public/i, uiTimeout)
    // The canvas fills the main column edge to edge, down to the bottom of the window
    const column = await page.locator('#center-column').boundingBox()
    const filled = await canvas.locator('[data-block="canvas"]').boundingBox()
    expect(Math.abs(filled.x - column.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(filled.width - column.width)).toBeLessThanOrEqual(1)
    expect(Math.abs((filled.y + filled.height) - page.viewportSize().height)).toBeLessThanOrEqual(2)
    await page.screenshot({ path: 'e2e-screenshots/designed-view-6-canvas.png' })

    // Zoom out with the control, then drag the surface
    const surface = canvas.getByTestId('designed-canvas-surface')
    await canvas.getByRole('button', { name: 'Zoom out' }).click()
    await expect(canvas.getByTestId('designed-canvas-zoom')).toHaveText('80%')
    const before = await surface.boundingBox()
    const viewport = canvas.getByTestId('designed-canvas-viewport')
    const box = await viewport.boundingBox()
    await page.mouse.move(box.x + box.width - 30, box.y + box.height - 60)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 230, box.y + box.height - 160, { steps: 5 })
    await page.mouse.up()
    const after = await surface.boundingBox()
    expect(Math.round(before.x - after.x)).toBe(200)
    expect(Math.round(before.y - after.y)).toBe(100)

    await canvas.getByRole('button', { name: 'Fit everything on screen' }).click()
    await page.screenshot({ path: 'e2e-screenshots/designed-view-7-canvas-fit.png' })
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
    await expect(chat.getByRole('textbox', { name: 'Message' })).toBeDisabled()
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
