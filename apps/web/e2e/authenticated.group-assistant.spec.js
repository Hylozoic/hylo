import { test, expect } from '@playwright/test'
import { execFileSync } from 'child_process'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { canSeedHyloPro, grantHyloPro, revokeHyloPro } from './helpers/hyloProGrant.js'

/**
 * The Group Assistant (Axl) in a real logged-in session: a steward turns it on
 * in Group Settings (saved for real), the row appears in the group menu, and
 * the steward thread shows Axl's answer with its parts. Only the AI answer is
 * stubbed, so no model runs.
 * Requires the E2E seed's Administrator role for the login user on e2e-public-group.
 */

test.describe.configure({ timeout: 180000, mode: 'serial' })

const GROUP_SLUG = 'e2e-public-group'
const PRO_NOTE = 'e2e group assistant spec'
const uiTimeout = { timeout: 60000 }

function sql (query) {
  return execFileSync('psql', [process.env.E2E_DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' }).trim()
}

const resetAssistant = () => {
  sql(`UPDATE groups SET settings = COALESCE(settings, '{}'::jsonb) - 'assistant' WHERE slug = '${GROUP_SLUG}'`)
  sql(`DELETE FROM group_assistant_messages WHERE group_id = (SELECT id FROM groups WHERE slug = '${GROUP_SLUG}')`)
}

const now = new Date().toISOString()
const answer = {
  messages: [
    { id: '900001', authorType: 'steward', author: { id: '0', name: 'E2E Steward', avatarUrl: null }, text: 'Help me with a conflict', parts: [], createdAt: now },
    {
      id: '900002',
      authorType: 'axl',
      author: null,
      text: 'Here is how I would approach it. Both people are making points in good faith.',
      parts: [
        {
          type: 'counsel',
          steps: [
            { title: 'Name what is working first', line: 'Thank both of them for taking the question seriously.' },
            { title: 'Separate the idea from the people', line: 'Restate the two positions in neutral words.' },
            { title: 'Hold the agreement lightly', line: 'Point to your “disagree with curiosity” agreement rather than to either person.' }
          ]
        },
        { type: 'bullets', items: ['Two posts have no reply yet', 'One newcomer has not been welcomed'] },
        { type: 'draft', text: 'Thank you both for pushing on this.\n\nLet’s keep both views in sight.', title: 'On the regenerative thread', groupId: '1', space: 'E2E Public Group' }
      ],
      createdAt: now
    }
  ],
  usage: { model: 'claude-opus-5-5', inputTokens: 5200, outputTokens: 420, estimatedCostUsd: 0.0292, pricePerMillionTokens: { input: 4, output: 20 } }
}

test.describe('group assistant', () => {
  test.skip(({ isMobile }) => isMobile, 'The assistant side panel is a desktop layout for now')
  test.skip(!canSeedHyloPro, 'needs E2E_DATABASE_URL to give the group Hylo Pro')

  test.beforeAll(() => {
    if (!canSeedHyloPro) return
    resetAssistant()
    grantHyloPro(GROUP_SLUG, PRO_NOTE)
  })
  test.afterAll(() => {
    if (!canSeedHyloPro) return
    resetAssistant()
    revokeHyloPro(PRO_NOTE)
  })

  test('a steward turns Axl on, finds it in the menu, and gets counsel and a draft', async ({ page }) => {
    let asked = null
    await page.route('**/noo/graphql', async route => {
      const body = route.request().postData() || ''
      if (!body.includes('AskGroupAssistant')) return route.continue()
      asked = JSON.parse(body).variables
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { askGroupAssistant: answer } }) })
    })

    // Off to begin with: the screen says so and points at settings
    await page.goto(`/groups/${GROUP_SLUG}/assistant`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByTestId('assistant-unavailable')).toContainText('turned off', uiTimeout)

    // Turn it on in Group Settings; the group's own posts are chosen to start with
    await page.goto(`/groups/${GROUP_SLUG}/settings`)
    await waitPastRootSessionLoading(page)
    await page.getByRole('link', { name: 'Group Assistant' }).first().click(uiTimeout)
    const settings = page.getByTestId('assistant-settings')
    await expect(settings).toBeVisible(uiTimeout)
    await expect(settings.getByTestId('assistant-space')).toHaveCount(0)
    await settings.getByTestId('assistant-enabled').click()
    await expect(settings.getByTestId('assistant-space').first()).toHaveAttribute('aria-pressed', 'true', uiTimeout)
    await expect(settings).toContainText('never direct messages')
    await page.screenshot({ path: 'e2e-screenshots/group-assistant-1-settings.png' })
    // Saved for real, with the group itself as the one readable space
    const stored = JSON.parse(sql(`SELECT settings->'assistant' FROM groups WHERE slug = '${GROUP_SLUG}'`))
    expect(stored.enabled).toBe(true)
    expect(stored.readableGroupIds).toHaveLength(1)

    // The row is in the group menu now
    await page.goto(`/groups/${GROUP_SLUG}`)
    await waitPastRootSessionLoading(page)
    const row = page.getByTestId('menu-group-assistant')
    await expect(row).toContainText('Group Assistant', uiTimeout)
    await expect(row).toContainText('Axl · all caught up')
    await row.getByRole('link').click()

    // The thread: who sees it, what Axl can read, and a greeting
    const screen = page.getByTestId('group-assistant')
    await expect(screen).toBeVisible(uiTimeout)
    await expect(page.getByTestId('assistant-stewards')).toContainText('Only stewards see this')
    await expect(screen).toContainText('It can read:')
    await expect(page.getByTestId('assistant-greeting')).toContainText('I’m Axl')
    await expect(page.getByTestId('assistant-usage')).toHaveText('$0.00')
    const panel = page.getByTestId('assistant-side-panel')
    await expect(panel).toContainText('Needs a steward')
    await expect(panel).toContainText('Settings changes')
    await expect(panel).toContainText('This week')

    // Ask with a suggestion chip
    await screen.getByRole('button', { name: 'Help me with a conflict' }).click()
    await expect(page.getByTestId('assistant-message-axl')).toContainText('Both people are making points in good faith', uiTimeout)
    expect(asked.text).toBe('Help me with a conflict')
    await expect(page.getByTestId('assistant-message-steward')).toContainText('Help me with a conflict')
    await expect(page.getByTestId('assistant-counsel').locator('li')).toHaveCount(3)
    await expect(page.getByTestId('assistant-bullets').locator('li')).toHaveCount(2)
    const draft = page.getByTestId('assistant-draft')
    await expect(draft).toContainText('Draft · posts as you in E2E Public Group')
    await expect(draft.getByRole('textbox', { name: 'Draft' })).toHaveValue(/Thank you both/)
    await expect(draft.getByTestId('assistant-post-draft')).toBeEnabled()
    await expect(page.getByTestId('assistant-usage')).toHaveText('$0.03')
    await page.screenshot({ path: 'e2e-screenshots/group-assistant-2-thread.png' })
  })
})
