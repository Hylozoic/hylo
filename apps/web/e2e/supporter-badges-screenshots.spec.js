/**
 * Screenshots for the Hylo supporter badges PR (#1754).
 *
 * Titled "capture screenshot" so the default e2e run skips it. The admin panel shot
 * needs the e2e user in HYLO_ADMINS, e.g.
 *   HYLO_ADMINS=1 E2E_DATABASE_URL=... yarn node scripts/run-isolated-e2e.js supporter-badges-screenshots --project=chromium
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP_SLUG = 'e2e-private-group'
const uiTimeout = { timeout: 60000 }
const shot = name => path.resolve(screenshotDir, `issue-1754-${name}.png`)

function psql (sql) {
  const dbUrl = process.env.E2E_DATABASE_URL
  if (!dbUrl || !/test/i.test(dbUrl)) throw new Error('E2E_DATABASE_URL must point at a test database')
  return execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-tAc', sql]).toString().trim()
}

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

/** Answers one GraphQL operation with `data`, letting everything else through. */
async function mockOperation (page, operationName, data) {
  await page.route('**/noo/graphql', route => {
    const body = route.request().postData() || ''
    if (body.includes(operationName)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
    return route.fallback()
  })
}

async function settle (page) {
  // Away from the global nav, which expands on hover
  await page.mouse.move(1270, 890)
  await page.waitForFunction(() => document.getAnimations().length === 0)
}

test('capture screenshot supporter badges', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop screenshots')
  test.setTimeout(300000)
  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.goto('/my/support')
  await waitPastRootSessionLoading(page)
  const { data } = await graphql(page, 'query ($slug: String) { me { id isAdmin } group(slug: $slug) { id } }', { slug: GROUP_SLUG })
  const userId = Number(data.me.id)
  const groupId = Number(data.group.id)
  const reset = () => psql(`DELETE FROM supporter_grants WHERE user_id = ${userId} OR group_id = ${groupId};
    DELETE FROM open_collective_orders WHERE oc_order_id LIKE 'e2e-1754-%';
    DELETE FROM supporter_links WHERE oc_account_id LIKE 'e2e-1754-%';
    UPDATE users SET settings = settings - 'show_supporter_badge' WHERE id = ${userId};
    UPDATE groups SET settings = settings - 'show_supporter_badge' WHERE id = ${groupId};`)
  reset()

  try {
    // Settings before any contribution, while Open Collective isn't configured
    await page.goto('/my/support')
    await expect(page.getByTestId('support-hylo-tab')).toBeVisible(uiTimeout)
    await settle(page)
    await page.screenshot({ path: shot('settings-not-supporter'), fullPage: true })

    // A linked monthly contribution, counted for the group, plus a one-time incognito one
    psql(`INSERT INTO supporter_links (user_id, oc_account_id, oc_account_slug, method) VALUES (${userId}, 'e2e-1754-acct', 'e2e-backer', 'email');
      INSERT INTO open_collective_orders (oc_order_id, oc_account_id, status, frequency, oc_created_at, tags, attributed_group_id, attributed_by_id)
        VALUES ('e2e-1754-a', 'e2e-1754-acct', 'ACTIVE', 'MONTHLY', now() - interval '40 days', '{}', ${groupId}, ${userId}),
               ('e2e-1754-b', 'e2e-1754-acct', 'PAID', 'ONETIME', now() - interval '500 days', '{}', NULL, NULL);`)
    await page.goto('/my/support')
    await expect(page.getByText('You are a Hylo supporter')).toBeVisible(uiTimeout)
    await page.getByTestId('show-supporter-badge').click()
    await expect(page.getByTestId('show-supporter-badge')).toHaveAttribute('aria-checked', 'true')
    await settle(page)
    await page.screenshot({ path: shot('settings-supporter'), fullPage: true })

    // Profile badge
    await page.goto(`/members/${userId}`)
    await expect(page.getByTestId('supporter-badge')).toBeVisible(uiTimeout)
    await settle(page)
    await page.screenshot({ path: shot('profile-badge') })

    // Group settings toggle, then the group badge
    await page.goto(`/groups/${GROUP_SLUG}/settings`)
    const section = page.getByTestId('group-supporter-section')
    await expect(section).toBeVisible(uiTimeout)
    await page.getByTestId('group-show-supporter-badge').click()
    await expect(page.getByTestId('group-show-supporter-badge')).toHaveAttribute('aria-checked', 'true')
    await section.scrollIntoViewIfNeeded()
    await settle(page)
    await page.screenshot({ path: shot('group-settings-toggle') })

    await page.goto(`/groups/${GROUP_SLUG}/about`)
    await expect(page.getByTestId('supporter-badge')).toBeVisible(uiTimeout)
    await settle(page)
    await page.screenshot({ path: shot('group-badge') })

    // Support modal
    await page.goto('/my/support')
    await page.getByTestId('open-support-hylo-modal').click()
    const modal = page.getByTestId('support-hylo-modal')
    await expect(modal).toBeVisible(uiTimeout)
    await expect(modal.getByRole('option', { name: /E2E Private Group/ })).toHaveCount(1)
    await modal.getByTestId('support-attribution').selectOption({ label: 'Me and E2E Private Group' })
    await settle(page)
    await page.screenshot({ path: shot('support-modal') })

    // Thanks page: the real "not configured" state, then mocked outcomes
    await page.goto('/support/thanks?orderIdV2=e2e-order&status=PAID')
    await expect(page.getByTestId('support-thanks')).toHaveAttribute('data-status', /notConfigured|error/, uiTimeout)
    await settle(page)
    await page.screenshot({ path: shot('thanks-not-configured') })

    await mockOperation(page, 'ConfirmSupportIntent', { confirmSupportIntent: { outcome: 'confirmed', supporterStatus: 'supporter', group: { id: String(groupId), name: 'E2E Private Group', slug: GROUP_SLUG } } })
    await page.goto('/support/thanks?orderIdV2=e2e-order&status=PAID')
    await expect(page.getByTestId('support-thanks')).toHaveAttribute('data-status', 'confirmed', uiTimeout)
    await settle(page)
    await page.screenshot({ path: shot('thanks-confirmed') })

    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await mockOperation(page, 'ConfirmSupportIntent', { confirmSupportIntent: { outcome: 'pending', supporterStatus: 'none', group: null } })
    await page.goto('/support/thanks?orderIdV2=e2e-order&status=PENDING')
    await expect(page.getByTestId('support-thanks')).toHaveAttribute('data-status', 'pending', uiTimeout)
    await settle(page)
    await page.screenshot({ path: shot('thanks-pending') })
    await page.unrouteAll({ behavior: 'ignoreErrors' })

    // Admin panel
    if (data.me.isAdmin) {
      psql(`INSERT INTO supporter_grants (group_id, note, granted_by_id, expires_at) VALUES (${groupId}, 'Hosted the 2026 community gathering', ${userId}, now() + interval '180 days')`)
      await page.goto('/management/supporters')
      await expect(page.getByTestId('management-supporters')).toBeVisible(uiTimeout)
      const panel = page.getByTestId('management-supporters')
      await page.getByTestId('supporter-search').fill('E2E Us')
      const result = panel.getByRole('button', { name: 'E2E User' }).first()
      await expect(result).toBeVisible(uiTimeout)
      await result.click()
      await expect(page.getByTestId('supporter-selected')).toBeVisible()
      await page.getByTestId('supporter-note').fill('Translated Hylo into Portuguese')
      await page.getByTestId('supporter-grant').click()
      await expect(page.getByTestId('supporter-grant-row')).toHaveCount(2, uiTimeout)
      await settle(page)
      await page.screenshot({ path: shot('management-supporters'), fullPage: true })
    }
  } finally {
    reset()
  }
})
