/**
 * Screenshots for Hylo staff saving a group theme on a group without Hylo Pro (#1781, T-09).
 *
 * Titled "capture screenshot" so the default e2e run skips it. It needs the e2e user in
 * HYLO_ADMINS, e.g.
 *   HYLO_ADMINS=1 E2E_DATABASE_URL=... yarn node scripts/run-isolated-e2e.js group-theme-staff-screenshots --project=chromium
 */
import fs from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { canSeedHyloPro, revokeHyloPro } from './helpers/hyloProGrant.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP_SLUG = 'e2e-public-group'
const PRO_NOTE = 'e2e group theme staff screenshots'
const uiTimeout = { timeout: 60000 }
const shot = name => path.resolve(screenshotDir, `issue-1781-${name}.png`)

async function graphql (page, query, variables = {}) {
  return page.evaluate(async ({ query, variables }) => {
    const res = await fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    })
    return res.json()
  }, { query, variables })
}

test('capture screenshot group theme for Hylo staff', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop screenshots')
  test.skip(!canSeedHyloPro, 'needs E2E_DATABASE_URL to make sure the group has no Hylo Pro')
  test.setTimeout(300000)
  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  revokeHyloPro(PRO_NOTE)

  await page.goto(`/groups/${GROUP_SLUG}/settings/appearance`)
  await waitPastRootSessionLoading(page)
  const { data } = await graphql(page, 'query ($slug: String) { me { id isAdmin } group(slug: $slug) { id proFeatures { groupThemes } } }', { slug: GROUP_SLUG })
  test.skip(!data?.me?.isAdmin, `e2e user ${data?.me?.id} is not in HYLO_ADMINS`)
  expect(data.group.proFeatures?.groupThemes).toBeFalsy()

  await expect(page.getByTestId('group-theme-editor')).toBeVisible(uiTimeout)
  await expect(page.getByTestId('group-theme-staff-notice')).toBeVisible()
  await expect(page.getByTestId('group-theme-pro-notice')).toHaveCount(0)

  await page.getByTestId('group-theme-preset-forest').click()
  await page.getByLabel('Start from a website').fill('example.org')
  await expect(page.getByRole('button', { name: 'Import look' })).toBeEnabled()
  const save = page.getByRole('button', { name: 'Save theme' })
  await expect(save).toBeEnabled()
  await page.getByTestId('group-theme-staff-notice').scrollIntoViewIfNeeded()
  await page.mouse.move(1270, 890)
  await page.screenshot({ path: shot('staff-save-enabled') })

  await save.click()
  await expect(page.getByText('Theme saved')).toBeVisible(uiTimeout)
  await page.getByText('Theme saved').scrollIntoViewIfNeeded()
  await page.screenshot({ path: shot('staff-saved') })

  // Leave the seed as it was
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reset to default' }).click()
  await expect(page.getByText('Theme reset to default')).toBeVisible(uiTimeout)
})
