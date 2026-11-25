import { test, expect } from '@playwright/test'
import { execFileSync } from 'child_process'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { canSeedHyloPro, grantHyloPro, revokeHyloPro } from './helpers/hyloProGrant.js'

/**
 * The "Design your own view" chat is one conversation per designed view, shared by the group's
 * stewards (decision V-05 on #1782): each question shows who asked, and a tab that is behind
 * another steward's change loads the session again instead of overwriting it.
 *
 * Another steward is played by writing to the stored session directly. Only the AI turn is stubbed.
 */

test.describe.configure({ timeout: 180000, mode: 'serial' })

const GROUP_SLUG = 'e2e-private-group'
const PRO_NOTE = 'e2e designed view shared spec'
const VIEW_NAME = 'E2E Shared design'
const OTHER_EMAIL = 'e2e.member-a@hylo.test'
const uiTimeout = { timeout: 60000 }

const savedDesign = { version: 1, blocks: [{ type: 'heading', text: 'Garden days', level: 1 }] }
const turn = {
  reply: 'I added the work day times under the heading.',
  view: { version: 1, blocks: [...savedDesign.blocks, { type: 'text', text: 'Saturdays from 10am.' }] },
  usage: { model: 'claude-opus-5-5', inputTokens: 1200, outputTokens: 200, estimatedCostUsd: 0.008, pricePerMillionTokens: { input: 4, output: 20 } }
}

function sql (query) {
  return execFileSync('psql', [process.env.E2E_DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' }).trim()
}

const json = value => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
const deleteView = () => sql(`DELETE FROM group_views WHERE type = 'designed' AND name = '${VIEW_NAME}'`)
const userId = email => sql(`SELECT id FROM users WHERE lower(email) = '${email}'`)
const storedMessages = viewId => JSON.parse(sql(`SELECT messages::text FROM group_view_design_sessions WHERE view_id = ${viewId}`) || '[]')

async function stubDesignTurn (page) {
  await page.route('**/noo/graphql', async route => {
    const body = route.request().postData() || ''
    if (!body.includes('DesignGroupViewTurn')) return route.continue()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { designGroupViewTurn: turn } }) })
  })
}

test.describe('the shared design conversation', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop layout; the phone designer is covered by authenticated.designed-view-mobile.spec.js')
  test.skip(!canSeedHyloPro, 'needs E2E_DATABASE_URL to give the group Hylo Pro')

  let otherAvatar
  test.beforeAll(() => {
    if (!canSeedHyloPro) return
    deleteView()
    grantHyloPro(GROUP_SLUG, PRO_NOTE)
    otherAvatar = sql(`SELECT COALESCE(avatar_url, '') FROM users WHERE lower(email) = '${OTHER_EMAIL}'`)
    sql(`UPDATE users SET avatar_url = '/default-user.svg' WHERE lower(email) = '${OTHER_EMAIL}'`)
  })
  test.afterAll(() => {
    if (!canSeedHyloPro) return
    deleteView()
    revokeHyloPro(PRO_NOTE)
    sql(`UPDATE users SET avatar_url = ${otherAvatar ? `'${otherAvatar}'` : 'NULL'} WHERE lower(email) = '${OTHER_EMAIL}'`)
  })

  test('shows who asked each question, and reloads when another steward got there first', async ({ page }) => {
    const otherId = userId(OTHER_EMAIL)
    const viewId = sql(`INSERT INTO group_views (group_id, name, type, "order", icon, settings, created_at, updated_at)
      SELECT g.id, '${VIEW_NAME}', 'designed',
        (SELECT COALESCE(MAX("order"), 0) + 1 FROM group_views WHERE group_id = g.id AND "order" IS NOT NULL),
        'LayoutTemplate', ${json({ design: savedDesign })}, now(), now()
      FROM groups g WHERE g.slug = '${GROUP_SLUG}'
      RETURNING id`).split('\n')[0]
    // Another steward started the conversation
    sql(`INSERT INTO group_view_design_sessions (group_id, view_id, messages, draft, version, updated_by_id)
      SELECT group_id, id, ${json([
        { role: 'user', text: 'A page for our garden work days', userId: otherId },
        { role: 'assistant', text: 'Here is a page with a heading for the work days.' }
      ])}, NULL, 1, ${otherId} FROM group_views WHERE id = ${viewId}`)
    await stubDesignTurn(page)

    await page.goto(`/groups/${GROUP_SLUG}/design/${viewId}`)
    await waitPastRootSessionLoading(page)
    const chat = page.getByTestId('designer-chat-column')
    await expect(chat).toContainText('A page for our garden work days', uiTimeout)
    await expect(chat.getByTestId('designer-message-author').first()).toHaveText('E2E Member A')

    // This steward carries the same conversation on, and their question is theirs
    await chat.getByRole('textbox', { name: 'Message' }).fill('Add the work day times')
    await chat.getByRole('button', { name: 'Send' }).click()
    await expect(chat).toContainText(turn.reply, uiTimeout)
    await expect(chat.getByTestId('designer-message-author')).toHaveText(['E2E Member A', 'E2E User'])
    await expect.poll(() => storedMessages(viewId).length, uiTimeout).toBe(4)
    expect(storedMessages(viewId)[2]).toEqual({ role: 'user', text: 'Add the work day times', userId: userId('e2e.user@hylo.test') })
    await page.screenshot({ path: 'e2e-screenshots/issue-1782-shared-design-chat.png' })

    // Meanwhile the other steward asks for something, so this tab is behind
    sql(`UPDATE group_view_design_sessions
      SET messages = messages || ${json([
        { role: 'user', text: 'Make the heading friendlier', userId: otherId },
        { role: 'assistant', text: 'I changed the heading to "Come grow with us".' }
      ])}, version = version + 1, updated_by_id = ${otherId}
      WHERE view_id = ${viewId}`)
    await chat.getByRole('textbox', { name: 'Message' }).fill('Add a photo')
    await chat.getByRole('button', { name: 'Send' }).click()

    // Nothing is overwritten: the chat loads again with their change, and the question is kept to send again
    await expect(chat.getByTestId('designer-changed-by-other')).toBeVisible(uiTimeout)
    await expect(chat).toContainText('Make the heading friendlier', uiTimeout)
    await expect(chat.getByRole('textbox', { name: 'Message' })).toHaveValue('Add a photo')
    await expect(chat.getByTestId('designer-message-author')).toHaveText(['E2E Member A', 'E2E User', 'E2E Member A'])
    expect(storedMessages(viewId).map(message => message.text)).not.toContain('Add a photo')
    await page.screenshot({ path: 'e2e-screenshots/issue-1782-shared-design-chat-reloaded.png' })
  })
})
