/**
 * Settings → Account → AT Protocol identity, end to end against the local AT Protocol sandbox.
 *
 * Screenshot-only (excluded from `yarn test:e2e` by name): it needs the sandbox running and the
 * E2E user's domain to be eligible. From apps/web, with the sandbox relay started:
 *   ATPROTO_ALLOWED_EMAIL_DOMAINS=hylo.test ../../tools/atproto-sandbox/with-sandbox.sh \
 *     node scripts/run-isolated-e2e.js atproto-settings --project=chromium
 * The isolated backend inherits the sandbox ATPROTO_* settings from apps/backend/.env.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

async function capture (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  const filePath = path.resolve(screenshotDir, `${name}.png`)
  await page.getByTestId('atproto-identity-section').scrollIntoViewIfNeeded()
  await page.screenshot({ path: filePath })
  console.log(`Screenshot saved: ${filePath}`)
}

test('capture screenshot: atproto identity in account settings', async ({ page }) => {
  await page.goto('/my/account')
  await waitPastRootSessionLoading(page)

  const section = page.getByTestId('atproto-identity-section')
  await expect(section).toBeVisible()
  await expect(section).toContainText('Your new handle:')
  await capture(page, 'atproto-settings-1-before')

  await page.getByTestId('atproto-create-identity').click()
  await expect(section).toContainText('did:plc:', { timeout: 30000 })
  await expect(section).toContainText('Active')
  const did = (await section.textContent()).match(/did:plc:[a-z2-7]+/)[0]
  console.log(`Created ${did}`)
  await capture(page, 'atproto-settings-2-created')
})
