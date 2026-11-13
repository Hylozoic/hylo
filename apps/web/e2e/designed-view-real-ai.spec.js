/**
 * One real "Design your own view" turn, with nothing stubbed: the browser, the
 * API and the AI model. It costs a few cents per run and needs CLAUDE_API_KEY
 * in the backend's environment, so it only runs when asked for:
 *   E2E_REAL_AI=1 yarn node scripts/run-isolated-e2e.js designed-view-real-ai --project=chromium
 * Titled "capture screenshot" so the default e2e run skips it.
 */
import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { canSeedHyloPro, grantHyloPro, revokeHyloPro } from './helpers/hyloProGrant.js'

const GROUP_SLUG = 'e2e-public-group'
const PRO_NOTE = 'e2e designed view real ai spec'

test('capture screenshot designed view real ai', async ({ page }) => {
  test.setTimeout(240000)
  test.skip(process.env.E2E_REAL_AI !== '1', 'set E2E_REAL_AI=1 to spend a few cents on a real AI turn')
  test.skip(!canSeedHyloPro, 'needs E2E_DATABASE_URL to give the group Hylo Pro')

  grantHyloPro(GROUP_SLUG, PRO_NOTE)
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`/groups/${GROUP_SLUG}/design/new`)
    await waitPastRootSessionLoading(page)

    const chat = page.getByTestId('designer-chat-column')
    await expect(chat).toBeVisible({ timeout: 90000 })
    await chat.getByLabel('Message').fill('Make a welcome page for new members. Show the latest posts and who is in the group side by side, and finish with a button to the events.')
    await chat.getByRole('button', { name: 'Send' }).click()

    const canvas = page.getByTestId('designer-canvas')
    await expect(canvas.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 120000 })
    await expect(chat.locator('[data-role="assistant"]')).toHaveCount(1)
    await expect(page.getByTestId('designer-usage')).toContainText('Last message:')
    await expect(canvas.locator('[data-block="posts"]').first()).toBeVisible()
    await page.screenshot({ path: 'e2e-screenshots/designed-view-real-ai.png' })
    console.log('[real ai] reply:', await chat.locator('[data-role="assistant"]').innerText())
    console.log('[real ai] usage:', (await page.getByTestId('designer-usage').innerText()).replace(/\n/g, ' | '))
  } finally {
    revokeHyloPro(PRO_NOTE)
  }
})
