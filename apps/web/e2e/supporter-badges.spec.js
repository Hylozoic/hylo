/**
 * Hylo supporter badges (#1754), covering what works without Open Collective
 * (CI has no OPEN_COLLECTIVE_TOKEN):
 * - supporter status given by Hylo staff is opt-in on the profile, and switching
 *   the badge off hides it straight away;
 * - the Support Hylo modal sends people to the right Open Collective URL;
 * - /support/thanks degrades gracefully while the integration isn't configured;
 * - (Hylo admins only) granting and revoking status in /management/supporters.
 *
 * The opt-in and admin tests change the shared e2e user, so they run in chromium only.
 * The admin test needs HYLO_ADMINS to include the e2e user's id, like commons-requests.spec.js.
 */
import { execFileSync } from 'child_process'
import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const uiTimeout = { timeout: 60000 }

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

async function currentUser (page) {
  const res = await graphql(page, 'query { me { id isAdmin } }')
  return res.data.me
}

function resetSupporterState (userId) {
  const id = Number(userId)
  psql(`DELETE FROM supporter_grants WHERE user_id = ${id};
        UPDATE users SET settings = settings - 'show_supporter_badge' WHERE id = ${id};`)
}

async function expectProfileBadge (page, userId, visible) {
  await page.goto(`/members/${userId}`)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible(uiTimeout)
  if (visible) await expect(page.getByTestId('supporter-badge')).toBeVisible(uiTimeout)
  else await expect(page.getByTestId('supporter-badge')).toHaveCount(0)
}

test.describe('supporter badges', () => {
  // The opt-in and admin tests both reset the shared e2e user's supporter state
  test.describe.configure({ mode: 'serial' })

  test('staff-given supporter status only shows once the person opts in', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'changes the shared e2e user')
    test.setTimeout(180000)
    await page.goto('/my/support')
    await waitPastRootSessionLoading(page)
    const me = await currentUser(page)
    resetSupporterState(me.id)

    try {
      psql(`INSERT INTO supporter_grants (user_id, note) VALUES (${Number(me.id)}, 'e2e: non-monetary contribution')`)

      // Linked/granted status alone shows nothing publicly
      await expectProfileBadge(page, me.id, false)

      await page.goto('/my/support')
      await expect(page.getByText('You are a Hylo supporter')).toBeVisible(uiTimeout)
      await expect(page.getByTestId('support-manual-grant')).toBeVisible()
      const toggle = page.getByTestId('show-supporter-badge')
      await expect(toggle).toHaveAttribute('aria-checked', 'false')
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-checked', 'true')
      await expect.poll(() => psql(`SELECT settings->>'show_supporter_badge' FROM users WHERE id = ${Number(me.id)}`)).toBe('true')

      await expectProfileBadge(page, me.id, true)

      // Switching it off hides the badge immediately
      await page.goto('/my/support')
      await page.getByTestId('show-supporter-badge').click()
      await expect(page.getByTestId('show-supporter-badge')).toHaveAttribute('aria-checked', 'false')
      await expect.poll(() => psql(`SELECT settings->>'show_supporter_badge' FROM users WHERE id = ${Number(me.id)}`)).toBe('false')
      await expectProfileBadge(page, me.id, false)
    } finally {
      resetSupporterState(me.id)
    }
  })

  test('the Support Hylo modal opens Open Collective with the presets, an opaque tag and the return URL', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/my/support')
    await waitPastRootSessionLoading(page)
    await page.getByTestId('open-support-hylo-modal').click()
    const modal = page.getByTestId('support-hylo-modal')
    await expect(modal).toBeVisible(uiTimeout)
    await modal.getByRole('radio', { name: 'Yearly' }).click()
    await modal.getByRole('button', { name: '$50' }).click()

    // Don't leave for the real Open Collective: catch the navigation instead
    await page.route('https://opencollective.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Open Collective</p>' }))
    const request = page.waitForRequest(r => r.isNavigationRequest() && r.url().startsWith('https://opencollective.com/'))
    await modal.getByTestId('support-hylo-continue').click()
    const url = new URL((await request).url())

    expect(url.origin + url.pathname).toBe('https://opencollective.com/hylo/donate')
    expect(url.searchParams.get('amount')).toBe('50')
    expect(url.searchParams.get('interval')).toBe('year')
    expect(url.searchParams.get('tags')).toMatch(/^hylo-[0-9a-f]{32}$/)
    expect(new URL(url.searchParams.get('redirect')).pathname).toBe('/support/thanks')
  })

  test('the thanks page explains that matching is not available yet', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/support/thanks?orderId=1&orderIdV2=e2e-order&status=PAID')
    await waitPastRootSessionLoading(page)
    const thanks = page.getByTestId('support-thanks')
    await expect(thanks).not.toHaveAttribute('data-status', 'loading', uiTimeout)
    // CI has no OPEN_COLLECTIVE_TOKEN; with one, an unknown order id gives the generic fallback
    await expect(thanks).toHaveAttribute('data-status', /notConfigured|error/)
    await expect(page.getByRole('link', { name: 'Go to your Support Hylo settings' })).toBeVisible()
  })

  test('Hylo admins can give and revoke supporter status in /management', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'changes the shared e2e user')
    test.setTimeout(180000)
    await page.goto('/my/support')
    await waitPastRootSessionLoading(page)
    const me = await currentUser(page)
    test.skip(!me.isAdmin, `e2e user ${me.id} is not in HYLO_ADMINS`)
    resetSupporterState(me.id)

    try {
      const { data } = await graphql(page, 'query ($id: ID) { person(id: $id) { name } }', { id: me.id })
      await page.goto('/management/supporters')
      await expect(page.getByTestId('management-supporters')).toBeVisible(uiTimeout)
      await page.getByTestId('supporter-search').fill(data.person.name.slice(0, 6))
      await page.getByRole('button', { name: data.person.name }).first().click()
      await page.getByTestId('supporter-note').fill('Ran onboarding workshops')
      await page.getByTestId('supporter-grant').click()
      const row = page.getByTestId('supporter-grant-row').filter({ hasText: 'Ran onboarding workshops' })
      await expect(row).toBeVisible(uiTimeout)
      expect(psql(`SELECT granted_by_id FROM supporter_grants WHERE user_id = ${Number(me.id)} AND revoked_at IS NULL`)).toBe(String(me.id))

      // The person still opts in
      await expectProfileBadge(page, me.id, false)
      await graphql(page, 'mutation { setSupporterBadgeVisibility(show: true) }')
      await expectProfileBadge(page, me.id, true)

      await page.goto('/management/supporters')
      page.once('dialog', dialog => dialog.accept())
      await page.getByTestId('supporter-grant-row').filter({ hasText: 'Ran onboarding workshops' }).getByRole('button', { name: 'Remove supporter status' }).click()
      await expect(page.getByTestId('supporter-grant-row').filter({ hasText: 'Ran onboarding workshops' })).toHaveCount(0)
      await expectProfileBadge(page, me.id, false)
    } finally {
      resetSupporterState(me.id)
    }
  })
})
