/**
 * Screenshots for the Hylo Pro management page (/management/paid-content/hylo-pro).
 *
 * Titled "capture screenshot" so the default e2e run skips it: the page is for Hylo staff, which
 * needs HYLO_ADMINS to include the e2e user's id, and the spec writes rows with psql, e.g.
 *   HYLO_ADMINS=1 E2E_DATABASE_URL=... yarn node scripts/run-isolated-e2e.js hylo-pro-management --project=chromium
 * The Stripe rows are fake (no Stripe calls are made), so Payments isn't opened. /management is a
 * desktop tool (its menu covers the page at phone width), so there's no phone screenshot.
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const SUB_PREFIX = 'sub_e2e_1712_'
const NOTE = 'Pilot partner for the 2027 regional network'

function sql (query) {
  return execFileSync('psql', [process.env.E2E_DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' }).trim()
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

function cleanUp () {
  sql(`DELETE FROM hylo_pro_subscriptions WHERE stripe_subscription_id LIKE '${SUB_PREFIX}%' OR note = '${NOTE}'`)
}

test('capture screenshot hylo pro management', async ({ page }) => {
  test.setTimeout(240000)
  test.skip(!process.env.E2E_DATABASE_URL, 'needs E2E_DATABASE_URL to seed rows')
  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.goto('/management/paid-content/hylo-pro')

  const me = await graphql(page, 'query { me { id isAdmin } }')
  test.skip(!me.data?.me?.isAdmin, `e2e user ${me.data?.me?.id} is not in HYLO_ADMINS`)

  const groups = sql("SELECT id || ':' || slug FROM groups WHERE active AND type IS DISTINCT FROM 'space' ORDER BY id LIMIT 4")
    .split('\n').map(line => { const [id, slug] = line.split(':'); return { id, slug } })
  expect(groups.length).toBe(4)

  cleanUp()
  try {
    const periodEnd = "now() + interval '20 days'"
    sql(`INSERT INTO hylo_pro_subscriptions (group_id, source, status, interval, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end, cancel_at_period_end, cancel_at, canceled_at, created_at, updated_at) VALUES
      (${groups[0].id}, 'stripe', 'active', 'month', '${SUB_PREFIX}month', 'cus_e2e_1', now() - interval '10 days', ${periodEnd}, false, null, null, now() - interval '40 days', now()),
      (${groups[1].id}, 'stripe', 'active', 'year', '${SUB_PREFIX}year', 'cus_e2e_2', now() - interval '30 days', now() + interval '335 days', true, now() + interval '335 days', now() - interval '2 days', now() - interval '30 days', now()),
      (${groups[2].id}, 'stripe', 'past_due', 'month', '${SUB_PREFIX}past_due', 'cus_e2e_3', now() - interval '1 day', now() + interval '29 days', false, null, null, now() - interval '70 days', now())`)

    await page.setViewportSize({ width: 1280, height: 1400 })
    await page.reload()
    await expect(page.getByTestId('hylo-pro-metrics')).toBeVisible({ timeout: 90000 }) // cold Vite can be slow
    // All three give Pro now: the past_due one is still inside its grace period
    await expect(page.getByTestId('hylo-pro-row')).toHaveCount(3)

    // Fill in a grant for the fourth group
    const form = page.getByTestId('hylo-pro-grant-form')
    await form.getByPlaceholder('my-group').fill(groups[3].slug)
    await form.locator('input[type="date"]').fill('2027-06-30')
    await form.getByLabel('Note (why it was granted)').fill(NOTE)
    await page.mouse.move(0, 0)
    await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1712-pro-management-grant-form.png') })

    await form.getByRole('button', { name: 'Grant Pro' }).click()
    const grantRow = page.getByTestId('hylo-pro-row').filter({ hasText: NOTE })
    await expect(grantRow).toBeVisible()
    await expect(grantRow).toContainText('Granted by')
    await expect(page.getByTestId('hylo-pro-rows')).toBeVisible()
    await page.mouse.move(0, 0)
    await page.screenshot({ path: path.resolve(screenshotDir, 'issue-1712-pro-management-overview.png'), fullPage: true })

    // Extend panel on the monthly subscription
    const monthRow = page.getByTestId('hylo-pro-row').filter({ hasText: `${SUB_PREFIX}month` })
    await monthRow.getByRole('button', { name: 'Extend' }).click()
    await expect(monthRow.getByLabel('Days to add')).toBeVisible()
    await monthRow.scrollIntoViewIfNeeded()
    await page.mouse.move(0, 0)
    await monthRow.screenshot({ path: path.resolve(screenshotDir, 'issue-1712-pro-management-extend.png') })

    // Grant's end date panel
    await grantRow.getByRole('button', { name: 'Change end date' }).click()
    await expect(grantRow.getByRole('button', { name: 'Remove end date' })).toBeVisible()
    await grantRow.screenshot({ path: path.resolve(screenshotDir, 'issue-1712-pro-management-grant-end-date.png') })

    // Payment failed filter
    await page.getByRole('tab', { name: 'Payment failed' }).click()
    await expect(page.getByTestId('hylo-pro-row')).toHaveCount(1)
    await expect(page.getByTestId('hylo-pro-row')).toContainText(`${SUB_PREFIX}past_due`)

    // Revoking the grant takes Pro away again
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('tab', { name: 'Grants' }).click()
    const grant = page.getByTestId('hylo-pro-row').filter({ hasText: NOTE })
    await grant.getByRole('button', { name: 'Revoke' }).click()
    await expect(grant).toContainText('Revoked')
  } finally {
    cleanUp()
  }
})
