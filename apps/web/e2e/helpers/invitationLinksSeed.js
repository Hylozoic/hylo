import { expect } from '@playwright/test'

/**
 * Slugs, codes, and tokens from `apps/backend/scripts/seed-e2e-baseline.js` — invitation / join / about E2E.
 * Matrix: Hidden / Protected / Public × Closed / Restricted (Open accessibility is intentionally excluded).
 */

export const PUBLIC_GROUP_SLUG = 'e2e-public-group'
export const PRIVATE_GROUP_SLUG = 'e2e-private-group'
export const PAYWALL_GROUP_SLUG = 'e2e-paywall-group'

/** @typedef {'hidden' | 'protected' | 'public'} InvitationVisibilityLabel */
/** @typedef {'closed' | 'restricted'} InvitationAccessibilityLabel */

/**
 * @typedef {Object} JoinLinkFixture
 * @property {string} label
 * @property {InvitationVisibilityLabel} visibility
 * @property {InvitationAccessibilityLabel} accessibility
 * @property {string} slug
 * @property {string} accessCode
 * @property {string} groupName
 * @property {boolean} requiresLoginWithoutLink
 */

/**
 * @typedef {Object} InviteLinkFixture
 * @property {string} label
 * @property {InvitationVisibilityLabel} visibility
 * @property {InvitationAccessibilityLabel} accessibility
 * @property {string} slug
 * @property {string} token
 * @property {string} groupName
 * @property {boolean} requiresLoginWithoutLink
 */

export const JOIN_LINK_FIXTURES = /** @type {JoinLinkFixture[]} */ ([
  {
    label: 'hidden closed',
    visibility: 'hidden',
    accessibility: 'closed',
    slug: 'e2e-join-hidden-closed',
    accessCode: 'e2ejohc001',
    groupName: 'E2E Join Hidden Closed',
    requiresLoginWithoutLink: true
  },
  {
    label: 'hidden restricted',
    visibility: 'hidden',
    accessibility: 'restricted',
    slug: 'e2e-hidden-join-group',
    accessCode: 'e2ehjco001',
    groupName: 'E2E Join Hidden Restricted',
    requiresLoginWithoutLink: true
  },
  {
    label: 'protected closed',
    visibility: 'protected',
    accessibility: 'closed',
    slug: 'e2e-join-protected-closed',
    accessCode: 'e2ejopc001',
    groupName: 'E2E Join Protected Closed',
    requiresLoginWithoutLink: true
  },
  {
    label: 'protected restricted',
    visibility: 'protected',
    accessibility: 'restricted',
    slug: 'e2e-join-protected-restricted',
    accessCode: 'e2ejopr001',
    groupName: 'E2E Join Protected Restricted',
    requiresLoginWithoutLink: true
  },
  {
    label: 'public closed',
    visibility: 'public',
    accessibility: 'closed',
    slug: 'e2e-join-code-group',
    accessCode: 'e2ejoincode001',
    groupName: 'E2E Join Public Closed',
    requiresLoginWithoutLink: false
  },
  {
    label: 'public restricted',
    visibility: 'public',
    accessibility: 'restricted',
    slug: 'e2e-join-public-restricted',
    accessCode: 'e2ejpubr001',
    groupName: 'E2E Join Public Restricted',
    requiresLoginWithoutLink: false
  }
])

export const INVITE_LINK_FIXTURES = /** @type {InviteLinkFixture[]} */ ([
  {
    label: 'hidden closed',
    visibility: 'hidden',
    accessibility: 'closed',
    slug: 'e2e-invite-hidden-closed',
    token: 'e2e-invite-hc-001',
    groupName: 'E2E Invite Hidden Closed',
    requiresLoginWithoutLink: true
  },
  {
    label: 'hidden restricted',
    visibility: 'hidden',
    accessibility: 'restricted',
    slug: 'e2e-invite-hidden-restricted',
    token: 'e2e-invite-hr-001',
    groupName: 'E2E Invite Hidden Restricted',
    requiresLoginWithoutLink: true
  },
  {
    label: 'protected closed',
    visibility: 'protected',
    accessibility: 'closed',
    slug: 'e2e-invite-protected-closed',
    token: 'e2e-invite-pc-001',
    groupName: 'E2E Invite Protected Closed',
    requiresLoginWithoutLink: true
  },
  {
    label: 'protected restricted',
    visibility: 'protected',
    accessibility: 'restricted',
    slug: 'e2e-invite-protected-restricted',
    token: 'e2e-invite-pr-001',
    groupName: 'E2E Invite Protected Restricted',
    requiresLoginWithoutLink: true
  },
  {
    label: 'public closed',
    visibility: 'public',
    accessibility: 'closed',
    slug: 'e2e-invite-public-closed',
    token: 'e2e-invite-uc-001',
    groupName: 'E2E Invite Public Closed',
    requiresLoginWithoutLink: false
  },
  {
    label: 'public restricted',
    visibility: 'public',
    accessibility: 'restricted',
    slug: 'e2e-invite-token-group',
    token: 'e2e-static-invite-token-001',
    groupName: 'E2E Invite Public Restricted',
    requiresLoginWithoutLink: false
  }
])

/** Back-compat aliases used by older specs / docs */
export const JOIN_CODE_GROUP_SLUG = JOIN_LINK_FIXTURES.find((f) => f.slug === 'e2e-join-code-group').slug
export const JOIN_ACCESS_CODE = JOIN_LINK_FIXTURES.find((f) => f.slug === 'e2e-join-code-group').accessCode
export const HIDDEN_JOIN_GROUP_SLUG = JOIN_LINK_FIXTURES.find((f) => f.slug === 'e2e-hidden-join-group').slug
export const HIDDEN_JOIN_ACCESS_CODE = JOIN_LINK_FIXTURES.find((f) => f.slug === 'e2e-hidden-join-group').accessCode
export const INVITE_TOKEN_GROUP_SLUG = INVITE_LINK_FIXTURES.find((f) => f.slug === 'e2e-invite-token-group').slug
export const INVITE_TOKEN = INVITE_LINK_FIXTURES.find((f) => f.slug === 'e2e-invite-token-group').token

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

/**
 * Authenticated about page with a valid join/invite link: direct Join CTA, not Request Membership.
 * @param {import('@playwright/test').Page} page
 * @param {string} groupDisplayName - seeded `groups.name`
 * @param {{ timeout?: number }} [opts]
 */
export async function expectAuthenticatedJoinLinkButton (page, groupDisplayName, opts = {}) {
  const ui = { timeout: 60000, ...opts }
  const button = page.locator('.JoinSection-JoinButton')
  await expect(button).toBeVisible(ui)
  await expect(button).toContainText(groupDisplayName, ui)
  await expect(button).not.toContainText(/Request Membership/i, ui)
}

/**
 * Closed/restricted groups without a join link should not expose a join CTA on the about page.
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number }} [opts]
 */
export async function expectNoJoinButton (page, opts = {}) {
  const ui = { timeout: 60000, ...opts }
  await expect(page.locator('.JoinSection-JoinButton')).toHaveCount(0, ui)
}
