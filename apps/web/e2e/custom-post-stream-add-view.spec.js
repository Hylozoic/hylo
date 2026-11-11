/**
 * Add View → Custom Post Stream (#1731): every post type pill shows a translated
 * label (requests and offers are separate pills), the Add View button explains a
 * missing name instead of sitting disabled, and a filled-in stream saves and
 * shows up in the group menu.
 */
import { test, expect } from '@playwright/test'
import { spawnSync } from 'child_process'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { openGlobalNavDrawerIfNeeded } from './helpers/sessionAuth.js'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

test.use({ storageState: 'e2e/.auth/session.json' })
test.setTimeout(180000)

const GROUP_SLUG = 'e2e-private-group'
const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const en = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/locales/en.json'), 'utf8'))
const PILLS = ['discussion', 'event', 'resource', 'project', 'proposal', 'request', 'offer']
const PILL_LABEL_KEYS = {
  discussion: 'view-discussions',
  event: 'view-events',
  resource: 'view-resources',
  project: 'view-projects',
  proposal: 'view-proposals',
  request: 'view-requests',
  offer: 'view-offers'
}

function e2eDatabaseUrl () {
  const url = new URL(process.env.E2E_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/hylo_e2e_test')
  if (!/test/i.test(url.pathname)) throw new Error(`Refusing to query non-test database ${url.pathname}`)
  return url.toString()
}

function sql (query) {
  const result = spawnSync('psql', [e2eDatabaseUrl(), '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`psql failed: ${result.stderr}`)
  return result.stdout.trim()
}

test('a custom post stream shows translated pills, explains a missing name and saves', async ({ page }) => {
  const project = test.info().project.name
  const viewName = `E2E 1731 Stream ${project}`
  fs.mkdirSync(screenshotDir, { recursive: true })
  sql(`delete from group_views where name = '${viewName}'`)

  await page.goto(`/groups/${GROUP_SLUG}`)
  await waitPastRootSessionLoading(page)
  await openGlobalNavDrawerIfNeeded(page)
  // The mobile drawer can still be sliding in when the first tap lands, so retry the toggle
  const addToMenu = page.getByText('Add to Menu', { exact: true })
  await expect(async () => {
    if (!await addToMenu.isVisible()) await page.getByRole('link', { name: 'Edit Menu' }).click()
    await expect(addToMenu).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 60000 })
  await addToMenu.click()
  await page.getByRole('menuitem').filter({ hasText: 'Add View' }).click()

  const addViewDialog = page.getByRole('dialog', { name: 'Add View' })
  await addViewDialog.getByRole('button', { name: /Custom Post Stream/ }).click()
  await addViewDialog.getByRole('button', { name: 'Next' }).click()

  const custom = page.locator('h2', { hasText: 'Custom Post Stream' }).locator('..')
  await expect(custom).toBeVisible()

  // Every pill carries its English label, never a raw i18n key
  for (const key of PILLS) {
    const pill = custom.getByTestId(`post-type-pill-${key}`)
    await expect(pill).toHaveText(en[PILL_LABEL_KEYS[key]])
    await expect(pill).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(custom.getByText(/view-(requests|offers)/)).toHaveCount(0)

  // Add View stays clickable; with no name it says why and focuses the Name field
  const addButton = custom.getByTestId('custom-view-add')
  await expect(addButton).toBeEnabled()
  await addButton.click()
  await expect(custom.getByText('Give this view a name of at least 2 characters')).toBeVisible()
  await expect(custom.getByTestId('custom-view-name')).toBeFocused()
  if (project === 'chromium') await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1731-name-required.png') })

  // Only offers, to exercise the separate request/offer pills
  await custom.getByTestId('custom-view-name').fill(viewName)
  await expect(custom.getByRole('alert')).toHaveCount(0)
  for (const key of PILLS.filter(k => k !== 'offer')) {
    await custom.getByTestId(`post-type-pill-${key}`).click()
  }
  await expect(custom.getByTestId('post-type-pill-offer')).toHaveAttribute('aria-pressed', 'true')
  await expect(custom.getByTestId('post-type-pill-request')).toHaveAttribute('aria-pressed', 'false')
  await expect(addButton).toBeEnabled()
  if (project === 'chromium') {
    await custom.getByTestId('post-type-pill-offer').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1731-filled-enabled.png') })
  }

  await addButton.click()
  await expect(custom).toBeHidden({ timeout: 30000 })
  await expect(page.getByText(viewName, { exact: true }).first()).toBeVisible({ timeout: 30000 })

  const saved = JSON.parse(sql(`select json_build_object('type', type, 'settings', settings) from group_views where name = '${viewName}'`))
  expect(saved.type).toBe('custom')
  expect(saved.settings.postTypes).toEqual(['offer'])

  if (project === 'chromium') await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1731-view-in-menu.png') })
  sql(`delete from group_views where name = '${viewName}'`)
})
