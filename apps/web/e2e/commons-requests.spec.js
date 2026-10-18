/**
 * Screenshots for the commons (allowInPublic) request flow: a steward asks from
 * Privacy & Access settings, and a Hylo admin reviews it in /management.
 *
 * Titled "capture screenshot" so the default e2e run skips it: the reviewer has to
 * be a Hylo admin, which needs HYLO_ADMINS to include the e2e user's id, e.g.
 *   HYLO_ADMINS=1 E2E_DATABASE_URL=... yarn node scripts/run-isolated-e2e.js commons-requests --project=chromium
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP_SLUG = 'e2e-private-group'

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

test('capture screenshot commons request flow', async ({ page }) => {
  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.goto(`/groups/${GROUP_SLUG}/settings/privacy`)

  const me = await graphql(page, 'query { me { id isAdmin } }')
  test.skip(!me.data?.me?.isAdmin, `e2e user ${me.data?.me?.id} is not in HYLO_ADMINS`)

  // The seeded group is hidden and not in the commons. Selecting Public shows the
  // section straight away; the request waits until Public is saved.
  await page.setViewportSize({ width: 1280, height: 1250 })
  await page.goto(`/groups/${GROUP_SLUG}/settings/privacy`)
  await page.getByText('Public', { exact: true }).click()
  const saveFirst = page.getByTestId('commons-request-save-first')
  await expect(saveFirst).toBeVisible()
  const button = page.getByTestId('commons-request-button')
  await expect(button).toBeDisabled()
  // Frame the Visibility choice and the commons section together
  await page.getByRole('heading', { name: 'Visibility' }).evaluate(el => el.scrollIntoView({ block: 'start' }))
  await page.mouse.move(0, 0)
  await page.waitForFunction(() => document.getAnimations().length === 0) // let the radio highlight transition finish
  await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1257-public-selected-unsaved.png') })

  await page.getByRole('button', { name: 'Save Changes' }).first().click()
  await expect(saveFirst).toHaveCount(0)
  await expect(button).toBeEnabled()
  await page.getByRole('heading', { name: 'Visibility' }).evaluate(el => el.scrollIntoView({ block: 'start' }))
  await page.mouse.move(0, 0)
  await page.waitForFunction(() => document.getAnimations().length === 0) // let the radio highlight transition finish
  await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1257-public-saved.png') })
  await page.setViewportSize({ width: 1280, height: 720 })

  // Steward entry point
  await page.getByLabel('Tell the Hylo team about your group (optional)').fill('We run open community gardens and want our events on the public map.')
  await button.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1257-steward-request.png') })

  await button.click()
  await expect(page.getByTestId('commons-request-pending')).toBeVisible()
  await page.getByTestId('commons-request-pending').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1257-steward-pending.png') })

  // Admin tracker with the pending request
  await page.goto('/management/site/commons-requests')
  const row = page.getByTestId('commons-request-row').filter({ hasText: 'E2E Private Group' })
  await expect(row).toBeVisible()
  await expect(row).toContainText('We run open community gardens')
  await row.getByRole('textbox').fill('Welcome to the Commons!')
  await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1257-management-pending.png') })

  await row.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByTestId('commons-request-row').filter({ hasText: 'E2E Private Group' })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Approved' }).click()
  const approvedRow = page.getByTestId('commons-request-row').filter({ hasText: 'E2E Private Group' })
  await expect(approvedRow).toContainText('Approved')
  await expect(approvedRow).toContainText('Welcome to the Commons!')
  await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1257-management-approved.png') })

  const after = await graphql(page, 'query ($slug: String) { group(slug: $slug) { allowInPublic publicListingRequest { status } } }', { slug: GROUP_SLUG })
  expect(after.data.group.allowInPublic).toBe(true)
  expect(after.data.group.publicListingRequest.status).toBe('approved')
})
