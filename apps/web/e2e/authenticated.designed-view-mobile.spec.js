import { test, expect } from '@playwright/test'
import { execFileSync } from 'child_process'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { canSeedHyloPro, grantHyloPro, revokeHyloPro } from './helpers/hyloProGrant.js'

/**
 * The designer on a phone, its "Preview mobile" toggle on a wide screen, and the stored session:
 * the chat with Axl and an unsaved page survive a reload (decision Q-27 on #1782). Once the
 * designedViews feature lapses, a saved view can still be renamed but not changed (Q-25).
 * Only the AI turn is stubbed; storing the session and saving the view are real.
 *
 * Each project edits its own designed view, made here in e2e-private-group, because the stored
 * session belongs to the steward, the group and the view.
 */

test.describe.configure({ timeout: 180000, mode: 'serial' })

const GROUP_SLUG = 'e2e-private-group'
const PRO_NOTE = 'e2e designed view mobile spec'
const uiTimeout = { timeout: 60000 }

const savedDesign = { version: 1, blocks: [{ type: 'heading', text: 'Our garden', level: 1 }, { type: 'text', text: 'The page before any change.' }] }

const turn = {
  reply: 'I added a two-column section with the latest posts and the members.',
  name: 'Garden',
  view: {
    version: 1,
    blocks: [
      { type: 'heading', text: 'Welcome to the garden', level: 1 },
      { type: 'callout', title: 'Work day', text: 'Saturday from 10am. Bring gloves.', tone: 'accent' },
      {
        type: 'columns',
        columns: [
          [{ type: 'posts', title: 'Latest posts', postTypes: [], limit: 4, layout: 'list' }],
          [{ type: 'members', title: 'Members', limit: 6 }]
        ]
      },
      { type: 'button', label: 'See all members', destination: 'members' }
    ]
  },
  usage: { model: 'claude-opus-5-5', inputTokens: 4411, outputTokens: 551, estimatedCostUsd: 0.028664, pricePerMillionTokens: { input: 4, output: 20 } }
}

function sql (query) {
  return execFileSync('psql', [process.env.E2E_DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' }).trim()
}

const VIEW_PREFIX = 'E2E Designed'
const viewName = project => `${VIEW_PREFIX} ${project}`

function createView (name) {
  sql(`DELETE FROM group_views WHERE type = 'designed' AND name = '${name}'`)
  return sql(`INSERT INTO group_views (group_id, name, type, "order", icon, settings, created_at, updated_at)
    SELECT g.id, '${name}', 'designed',
      (SELECT COALESCE(MAX("order"), 0) + 1 FROM group_views WHERE group_id = g.id AND "order" IS NOT NULL),
      'LayoutTemplate', '${JSON.stringify({ design: savedDesign })}'::jsonb, now(), now()
    FROM groups g WHERE g.slug = '${GROUP_SLUG}'
    RETURNING id`).split('\n')[0]
}

const deleteViews = () => sql(`DELETE FROM group_views WHERE type = 'designed' AND name LIKE '${VIEW_PREFIX} %'`)

async function stubDesignTurn (page) {
  await page.route('**/noo/graphql', async route => {
    const body = route.request().postData() || ''
    if (!body.includes('DesignGroupViewTurn')) return route.continue()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { designGroupViewTurn: turn } }) })
  })
}

// The stored session has caught up with the page once its row holds this many messages
function storedMessageCount (viewId) {
  return Number(sql(`SELECT COALESCE(jsonb_array_length(messages), 0) FROM group_view_design_sessions WHERE view_id = ${viewId}`) || 0)
}

test.describe('designed views on phones, previews and reloads', () => {
  test.skip(!canSeedHyloPro, 'needs E2E_DATABASE_URL to give the group Hylo Pro')

  test.beforeAll(() => {
    if (!canSeedHyloPro) return
    deleteViews()
    grantHyloPro(GROUP_SLUG, PRO_NOTE)
  })
  test.afterAll(() => {
    if (!canSeedHyloPro) return
    deleteViews()
    revokeHyloPro(PRO_NOTE)
  })

  test('on a phone the chat and the page are tabs, and a reload keeps both', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout')
    const viewId = createView(viewName('phone'))
    await stubDesignTurn(page)

    await page.goto(`/groups/${GROUP_SLUG}/design/${viewId}`)
    await waitPastRootSessionLoading(page)

    // The chat opens first, as wide as the phone
    const chat = page.getByTestId('designer-chat-column')
    await expect(chat).toBeVisible(uiTimeout)
    await expect(page.getByTestId('designer-tab-chat')).toHaveAttribute('aria-pressed', 'true')
    const width = page.viewportSize().width
    expect((await chat.boundingBox()).width).toBeGreaterThan(width - 4)
    await expect(page.getByTestId('designer-view-name')).toHaveText(viewName('phone'))
    await expect(page.getByTestId('designer-save')).toBeVisible()
    await page.screenshot({ path: 'e2e-screenshots/issue-1784-designer-phone-chat.png' })

    // The saved page is one tap away
    await page.getByTestId('designer-tab-page').click()
    await expect(page.getByTestId('designer-page').getByRole('heading', { level: 1, name: 'Our garden' })).toBeVisible()

    // Asking for a change in the chat redraws the page and shows it
    await page.getByTestId('designer-tab-chat').click()
    await chat.getByRole('textbox', { name: 'Message' }).fill('Add a work day notice and the latest posts beside the members')
    await chat.getByRole('button', { name: 'Send' }).click()
    const pageTab = page.getByTestId('designer-page')
    await expect(pageTab.getByRole('heading', { level: 1, name: 'Welcome to the garden' })).toBeVisible(uiTimeout)
    await expect(page.getByTestId('designer-tab-page')).toHaveAttribute('aria-pressed', 'true')
    // Columns stack on a phone
    const columns = pageTab.locator('[data-block="columns"]')
    await expect(columns).not.toHaveClass(/(^|\s)grid-cols-2/)
    await expect(pageTab.locator('[data-block="members"] a').first()).toBeVisible(uiTimeout)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(page.getByTestId('designer-status')).toHaveText('Unsaved changes')
    await page.screenshot({ path: 'e2e-screenshots/issue-1784-designer-phone-page.png' })

    // The chat and the unsaved page are stored, so a reload keeps them
    await expect.poll(() => storedMessageCount(viewId), uiTimeout).toBe(2)
    await page.reload()
    await waitPastRootSessionLoading(page)
    await expect(chat).toBeVisible(uiTimeout)
    await expect(chat).toContainText('Add a work day notice', uiTimeout)
    await expect(chat).toContainText(turn.reply)
    await expect(page.getByTestId('designer-status')).toHaveText('Unsaved changes')
    await page.screenshot({ path: 'e2e-screenshots/issue-1784-designer-phone-after-reload.png' })
    await page.getByTestId('designer-tab-page').click()
    await expect(page.getByTestId('designer-page').getByRole('heading', { level: 1, name: 'Welcome to the garden' })).toBeVisible(uiTimeout)
    // Nothing was saved to the view itself
    expect(JSON.parse(sql(`SELECT settings::text FROM group_views WHERE id = ${viewId}`)).design.blocks[0].text).toBe('Our garden')
  })

  test('on a wide screen "Preview mobile" shows the page at phone width, and a reload keeps the draft', async ({ page, isMobile }) => {
    test.skip(isMobile, 'wide-screen layout')
    const viewId = createView(viewName('desktop'))
    await stubDesignTurn(page)

    await page.goto(`/groups/${GROUP_SLUG}/design/${viewId}`)
    await waitPastRootSessionLoading(page)
    const chat = page.getByTestId('designer-chat-column')
    await expect(chat).toBeVisible(uiTimeout)
    // No tabs here: the chat sits beside the page
    await expect(page.getByTestId('designer-tab-chat')).toHaveCount(0)
    await chat.getByRole('textbox', { name: 'Message' }).fill('Add a work day notice and the latest posts beside the members')
    await chat.getByRole('button', { name: 'Send' }).click()

    const canvas = page.getByTestId('designer-canvas')
    await expect(canvas.getByRole('heading', { level: 1, name: 'Welcome to the garden' })).toBeVisible(uiTimeout)
    // Wide enough for the columns side by side
    await expect(canvas.locator('[data-block="columns"]')).toHaveClass(/(^|\s)grid-cols-2/)
    await expect(canvas.locator('[data-block="members"] a').first()).toBeVisible(uiTimeout)
    await page.screenshot({ path: 'e2e-screenshots/issue-1784-designer-desktop.png' })

    await page.getByTestId('designer-preview-mobile').click()
    await expect(page.getByTestId('designer-preview-mobile')).toHaveAttribute('aria-pressed', 'true')
    const preview = page.getByTestId('designer-phone-preview')
    const shown = preview.getByTestId('designed-view')
    await expect(shown).toBeVisible()
    expect(Math.round((await shown.boundingBox()).width)).toBe(390)
    // At phone width the columns stack, as they do on a phone
    await expect(preview.locator('[data-block="columns"]')).not.toHaveClass(/(^|\s)grid-cols-2/)
    await page.screenshot({ path: 'e2e-screenshots/issue-1784-designer-preview-mobile.png' })

    await expect.poll(() => storedMessageCount(viewId), uiTimeout).toBe(2)
    await page.reload()
    await waitPastRootSessionLoading(page)
    await expect(chat).toContainText(turn.reply, uiTimeout)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Welcome to the garden' })).toBeVisible(uiTimeout)
    await expect(page.getByTestId('designer-status')).toHaveText('Unsaved changes')
    await expect(page.getByTestId('designer-save')).toBeEnabled()
  })

  test('once the feature lapses the view can be renamed but its design not changed', async ({ page, isMobile }) => {
    test.skip(isMobile, 'wide-screen layout')
    const viewId = sql(`SELECT id FROM group_views WHERE type = 'designed' AND name = '${viewName('desktop')}'`)
    revokeHyloPro(PRO_NOTE)

    await page.goto(`/groups/${GROUP_SLUG}/design/${viewId}`)
    await waitPastRootSessionLoading(page)
    const chat = page.getByTestId('designer-chat-column')
    await expect(chat.getByTestId('designer-pro-notice')).toContainText('can still be renamed, moved or deleted', uiTimeout)
    await expect(chat.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    // The conversation can still be read, and the saved page is shown, not the unsaved one
    await expect(chat).toContainText(turn.reply)
    await expect(page.getByTestId('designer-canvas').getByRole('heading', { level: 1, name: 'Our garden' })).toBeVisible(uiTimeout)
    await expect(page.getByTestId('designer-save')).toBeDisabled()
    await page.screenshot({ path: 'e2e-screenshots/issue-1784-designer-lapsed.png' })

    await page.getByTestId('designer-view-name').click()
    await page.getByTestId('designer-view-name-input').fill('E2E Designed renamed')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('designer-save')).toBeEnabled()
    await page.getByTestId('designer-save').click()
    await expect(page).toHaveURL(new RegExp(`/designed/${viewId}$`), uiTimeout)
    const row = JSON.parse(sql(`SELECT json_build_object('name', name, 'settings', settings)::text FROM group_views WHERE id = ${viewId}`))
    expect(row.name).toBe('E2E Designed renamed')
    expect(row.settings.design.blocks[0].text).toBe('Our garden')
    grantHyloPro(GROUP_SLUG, PRO_NOTE)
  })
})
