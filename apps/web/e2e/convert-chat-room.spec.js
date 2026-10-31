/**
 * The chat-room conversion control is an admin-only action on chat-only spaces.
 * A normal space's settings must not show it.
 */
import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const GROUP = 'e2e-public-group'

test.use({ storageState: 'e2e/.auth/session.json' })
test.setTimeout(240000)

test('space settings hides chat conversion unless the space is a chat room', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only check')

  await page.goto(`/groups/${GROUP}/more-spaces?edit=true`)
  await waitPastRootSessionLoading(page)
  await page.waitForLoadState('networkidle')

  const settingsButton = page.locator('#center-column-container').locator('button[aria-label="Settings"]').first()
  await expect(settingsButton).toBeVisible({ timeout: 60000 })
  await settingsButton.click()
  await expect(page.locator('h2', { hasText: /Space Settings/ })).toBeVisible({ timeout: 20000 })

  const convertControl = page.getByTestId('convert-chat-space')
  const postTypes = page.getByText('Post types', { exact: true })
  await expect(postTypes).toBeVisible()

  // Shared fixture spaces accept the usual post types, so this stays tucked away.
  await expect(convertControl).toHaveCount(0)
})
