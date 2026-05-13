import { expect } from '@playwright/test'

/**
 * Slugs and tokens from `apps/backend/scripts/seed-e2e-baseline.js` — invitation / join / about E2E.
 */

export const PUBLIC_GROUP_SLUG = 'e2e-public-group'
export const PRIVATE_GROUP_SLUG = 'e2e-private-group'
export const PAYWALL_GROUP_SLUG = 'e2e-paywall-group'
export const JOIN_CODE_GROUP_SLUG = 'e2e-join-code-group'
export const JOIN_ACCESS_CODE = 'e2ejoincode001'
export const HIDDEN_JOIN_GROUP_SLUG = 'e2e-hidden-join-group'
export const HIDDEN_JOIN_ACCESS_CODE = 'e2ehjco001'
export const INVITE_TOKEN_GROUP_SLUG = 'e2e-invite-token-group'
export const INVITE_TOKEN = 'e2e-static-invite-token-001'

/** `GroupDetail` sets `<title>{name} | Hylo</title>` — stable for E2E. */
export const seededGroupTitlePattern = (groupName) => new RegExp(`${groupName} \\| Hylo`, 'i')

/**
 * `GroupDetail` always renders a Privacy settings block once the group has loaded (member or guest).
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number }} [opts]
 */
export async function expectGroupDetailAboutLoaded (page, opts = {}) {
  const ui = { timeout: 60000, ...opts }
  await expect(page.getByRole('heading', { name: /Privacy settings/i })).toBeVisible(ui)
}

/**
 * Logged-out about page: `GroupDetail` shows a login/signup link, not `JoinSection`, until the user authenticates.
 * @param {import('@playwright/test').Page} page
 * @param {string} groupDisplayName - seeded `groups.name` (e.g. "E2E Public Group")
 * @param {{ timeout?: number }} [opts]
 */
export async function expectUnauthenticatedAboutJoinGate (page, groupDisplayName, opts = {}) {
  const ui = { timeout: 60000, ...opts }
  const gate = page.getByRole('link', { name: /Signup or Login to connect with/i })
  await expect(gate).toBeVisible(ui)
  await expect(gate).toContainText(groupDisplayName, ui)
}
