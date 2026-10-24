import { execFileSync } from 'child_process'
import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

const GROUP_SLUG = 'e2e-public-group'
// More than one page (the backend returns 20 per page)
const INVITE_COUNT = 45
// First render can be slow when several browsers hit a cold Vite dev server
const uiTimeout = { timeout: 60000 }

function runSql (sql) {
  const dbUrl = process.env.E2E_DATABASE_URL
  if (!dbUrl || !/test/i.test(dbUrl)) throw new Error('E2E_DATABASE_URL must point at a test database')
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', sql])
}

// Each project gets its own email prefix so parallel runs don't trip over each other.
// Invites are dated in the past so they sort below any invites the seed or other tests create.
function seedPendingInvites (prefix) {
  runSql(`
    DELETE FROM group_invites WHERE email LIKE '${prefix}-%';
    INSERT INTO group_invites (created_at, last_sent_at, invited_by_id, token, email, group_id)
    SELECT timestamp '2001-01-01' + (n || ' minutes')::interval,
           timestamp '2001-01-01' + (n || ' minutes')::interval,
           g.created_by_id,
           '${prefix}-token-' || n,
           '${prefix}-' || lpad(n::text, 2, '0') || '@hylo.test',
           g.id
    FROM generate_series(1, ${INVITE_COUNT}) AS n, groups g
    WHERE g.slug = '${GROUP_SLUG}'`)
}

function emailFor (prefix, n) {
  return `${prefix}-${String(n).padStart(2, '0')}@hylo.test`
}

test('pending invites list loads more as you scroll to the bottom (#1592)', async ({ page }, testInfo) => {
  test.setTimeout(180000)
  const prefix = `issue-1592-${testInfo.project.name}`
  seedPendingInvites(prefix)

  try {
    await page.goto(`/groups/${GROUP_SLUG}/settings/invite`)
    await waitPastRootSessionLoading(page)

    const list = page.getByTestId('pending-invites')
    // Newest first, so the latest seeded invite is on the first page
    await expect(list.getByText(emailFor(prefix, INVITE_COUNT))).toBeVisible(uiTimeout)

    // The oldest invite is on the last page: keep scrolling to the bottom of the list until it loads
    const oldest = list.getByText(emailFor(prefix, 1))
    await expect(async () => {
      await page.getByTestId('pending-invite').last().scrollIntoViewIfNeeded()
      await expect(oldest).toBeVisible({ timeout: 2000 })
    }).toPass({ timeout: 60000 })

    // Every seeded invite is listed exactly once
    for (const n of [1, 2, 20, 21, 40, 41, INVITE_COUNT]) {
      await expect(list.getByText(emailFor(prefix, n), { exact: true })).toHaveCount(1)
    }

    // The bottom of the list can be scrolled into view
    await oldest.scrollIntoViewIfNeeded()
    await expect(oldest).toBeInViewport()
    // Every newly loaded row finishes fading in (none are left half-transparent)
    await expect(async () => {
      const opacities = await page.getByTestId('pending-invite').evaluateAll(rows => rows.map(r => window.getComputedStyle(r).opacity))
      expect(opacities.filter(o => o !== '1')).toEqual([])
    }).toPass({ timeout: 10000 })
    await page.screenshot({ path: `e2e/screenshots/issue-1592-pending-invites-${testInfo.project.name}.png` })
  } finally {
    runSql(`DELETE FROM group_invites WHERE email LIKE '${prefix}-%'`)
  }
})
