import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * #1248 — each Copy button on the Invite settings tab must show "Copied!" in its own
 * section only (Public Group Link vs Share a Join Link). Read-only: never regenerates the join link.
 * Seed: `e2e-public-group` (public, restricted) where the E2E user is Administrator.
 */

test.describe.configure({ timeout: 120000 })

const uiTimeout = { timeout: 60000 }
const INVITE_PATH = '/groups/e2e-public-group/settings/invite'

const SECTIONS = [
  { name: 'public group link', key: 'public', other: 'join' },
  { name: 'join link', key: 'join', other: 'public' }
]

test.describe('#1248 invite copy confirmation', () => {
  for (const { name, key, other } of SECTIONS) {
    test(`Copy on the ${name} shows Copied! only in that section`, async ({ page, context, browserName }, testInfo) => {
      // Lets the spec read back what was copied (Chromium only; WebKit has no clipboard permissions).
      if (browserName === 'chromium') {
        await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      }

      // "Copied!" clears after a 3s setTimeout; a controllable clock keeps the checks below
      // from racing that timeout on a slow machine (they'd pass after it cleared).
      await page.clock.install()
      await page.goto(INVITE_PATH)
      await waitPastRootSessionLoading(page)

      const button = page.getByTestId(`invite-${key}-link-copy`)
      const otherButton = page.getByTestId(`invite-${other}-link-copy`)
      const section = page.getByTestId(`invite-${key}-link-section`)
      const otherSection = page.getByTestId(`invite-${other}-link-section`)

      await expect(button).toBeVisible(uiTimeout)
      await expect(otherButton).toBeVisible(uiTimeout)
      await expect(section).not.toContainText('Copied!')
      await expect(otherSection).not.toContainText('Copied!')

      const linkText = (await button.locator('bdi').textContent()).trim()
      await page.clock.pauseAt(new Date(Date.now() + 5000))
      await button.click()

      await expect(button).toContainText('Copied!')
      await expect(otherSection).not.toContainText('Copied!')
      await expect(otherButton).toContainText('Copy')
      // The link itself stays visible after copying.
      await expect(button.locator('bdi')).toHaveText(linkText)

      if (browserName === 'chromium') {
        const copied = await page.evaluate(() => navigator.clipboard.readText())
        expect(copied).toBe(linkText)
      }

      await page.screenshot({ path: testInfo.outputPath(`issue-1248-${key}-copied.png`) })

      // Confirmation clears after its timeout and the button goes back to "Copy".
      await page.clock.runFor(3500)
      await expect(button).not.toContainText('Copied!')
      await expect(button).toContainText('Copy')
    })
  }
})
