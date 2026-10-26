/**
 * Management → AT Protocol → Identities (admin only).
 *
 * Screenshot-only (excluded from `yarn test:e2e` by name) because it needs the E2E user to be a
 * Hylo admin and the backend to have AT Protocol config:
 *   HYLO_ADMINS=1 yarn screenshot --grep "atproto"
 * (the isolated backend inherits apps/backend/.env, e.g. the sandbox ATPROTO_* settings)
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const PAGE = '/management/atproto/identities'

const populatedMetrics = {
  instance: {
    enabled: true,
    sandbox: false,
    plcUrl: 'https://plc.staging.hylo.com',
    productionPlc: false,
    pdsUrl: 'https://pds.staging.hylo.com',
    handleDomain: 'staging.hylo.com',
    allowedEmailDomains: ['hylo.com', 'terran.io'],
    allowlistSize: 4
  },
  identities: { active: 3, pending: 1, tombstoned: 1, total: 5 },
  eligibleWithoutIdentity: 1,
  foreignIdentities: 2,
  stuckPending: [
    { user_id: 1782, handle: 'sam.staging.hylo.com', did: 'did:plc:3vbm2q7xkz6yq4a5c2l7t5nh', created_at: '2026-10-27T01:12:00Z' }
  ],
  stuckPendingMinutes: 10,
  createdPerDay: [{ day: '2026-10-27', count: 3 }, { day: '2026-10-26', count: 2 }],
  tombstonedPerDay: [{ day: '2026-10-27', count: 1 }],
  days: 30,
  recent: [
    { user_id: 42883, user_name: 'Tom', handle: 'tom.staging.hylo.com', did: 'did:plc:rgljtthttmpthhoqtio7fig5', status: 'active', created_at: '2026-10-27T01:00:00Z' },
    { user_id: 7650, user_name: 'Tibet', handle: 'tibet.staging.hylo.com', did: 'did:plc:wcdlurxxyec56bispg7qg4ap', status: 'active', created_at: '2026-10-26T23:40:00Z' },
    { user_id: 1782, user_name: 'Sam', handle: 'sam.staging.hylo.com', did: 'did:plc:3vbm2q7xkz6yq4a5c2l7t5nh', status: 'pending', created_at: '2026-10-26T22:10:00Z' },
    { user_id: 3582, user_name: 'Alex', handle: 'alex.staging.hylo.com', did: 'did:plc:k2x7rm3qyjz5t6w4ab9c8d1e', status: 'tombstoned', created_at: '2026-10-26T21:00:00Z' }
  ]
}

async function capture (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  const filePath = path.resolve(screenshotDir, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: true })
  console.log(`Screenshot saved: ${filePath}`)
}

test.describe('Management: AT Protocol identities', () => {
  test('capture screenshot: atproto identities (real backend)', async ({ page }) => {
    await page.goto(PAGE)
    await waitPastRootSessionLoading(page)

    await expect(page.getByRole('heading', { name: 'AT Protocol Identities' })).toBeVisible()
    // Instance details come from the isolated backend's real ATPROTO_* config
    await expect(page.getByTestId('atproto-instance')).toContainText(process.env.ATPROTO_PLC_URL || 'PLC directory')
    await expect(page.getByRole('link', { name: 'Identities' })).toBeVisible()
    await capture(page, 'atproto-identities-real-backend')
  })

  test('capture screenshot: atproto identities (populated, mocked metrics)', async ({ page }) => {
    // The page scrolls inside the app layout, so use a tall viewport to capture all of it
    await page.setViewportSize({ width: 1280, height: 1500 })
    await page.route('**/noo/admin/atproto-metrics', route => route.fulfill({ json: populatedMetrics }))
    await page.route('**/noo/admin/atproto-verify-sample', route => route.fulfill({
      json: {
        results: [
          { handle: 'tom.staging.hylo.com', did: 'did:plc:rgljtthttmpthhoqtio7fig5', problems: [] },
          { handle: 'tibet.staging.hylo.com', did: 'did:plc:wcdlurxxyec56bispg7qg4ap', problems: ['handle mismatch: PLC has at://tibet-old.staging.hylo.com'] }
        ]
      }
    }))

    await page.goto(PAGE)
    await waitPastRootSessionLoading(page)
    await expect(page.getByText('Stuck pending')).toBeVisible()

    await page.getByTestId('atproto-verify-sample').click()
    await expect(page.getByTestId('atproto-verify-results')).toContainText('handle mismatch')
    await capture(page, 'atproto-identities-populated')
  })
})
