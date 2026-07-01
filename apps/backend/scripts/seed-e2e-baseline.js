/**
 * Minimal deterministic E2E data using a single pg connection (avoids Knex pool issues during isolated runs).
 * Expects DATABASE_URL (same as backend).
 * Do not run manually against your dev DB — use `cd apps/web && yarn test:e2e` (isolated `hylo_e2e`).
 */
const { Client } = require('pg')
const bcrypt = require('bcrypt')

/** Match `apps/web/scripts/run-isolated-e2e.js` — never seed a normal dev DB by accident. */
const DEFAULT_E2E_DB = 'hylo_e2e'
const DANGEROUS_DB_NAMES = new Set(['hylo', 'hylo_test', 'postgres', 'template0', 'template1'])

/**
 * Parse the database name from a Postgres connection URL.
 * @param {string} connectionString
 */
function databaseNameFromUrl (connectionString) {
  const withScheme = connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://')
    ? connectionString.trim()
    : `postgresql://${connectionString.trim()}`
  const u = new URL(withScheme)
  const segment = (u.pathname || '/').replace(/^\//, '').split('/')[0] || ''
  return segment ? decodeURIComponent(segment) : ''
}

/**
 * Refuse to run against a dev/shared database unless explicitly overridden.
 * Intended entrypoint: `yarn test:e2e` → run-isolated-e2e.js → hylo_e2e (fresh drop/create).
 * @param {string} connectionString
 */
function assertSafeE2eDatabase (connectionString) {
  const dbName = databaseNameFromUrl(connectionString).toLowerCase()
  if (!dbName) {
    console.error('[seed-e2e-baseline] Could not parse database name from DATABASE_URL')
    process.exit(1)
  }
  if (DANGEROUS_DB_NAMES.has(dbName) && process.env.E2E_ALLOW_DANGEROUS_DB !== '1') {
    console.error(
      `[seed-e2e-baseline] Refusing to seed database "${dbName}".\n` +
      `This script is for the isolated Playwright DB only (e.g. ${DEFAULT_E2E_DB}).\n` +
      'Run: cd apps/web && yarn test:e2e\n' +
      'Or point DATABASE_URL at your E2E database, not your dev database.'
    )
    process.exit(1)
  }
}

const SYSTEM_ROLE_DEFINITIONS = [
  {
    name: 'Coordinator',
    emoji: '🪄',
    description: 'Coordinators are empowered to do everything related to group administration.',
    responsibilities: ['Administration', 'Add Members', 'Remove Members', 'Manage Content', 'Manage Tracks', 'Manage Rounds']
  },
  {
    name: 'Moderator',
    emoji: '⚖️',
    description: 'Moderators are expected to actively engage in discussion, encourage participation, and take corrective action if a member violates group agreements.',
    responsibilities: ['Manage Content', 'Remove Members']
  },
  {
    name: 'Host',
    emoji: '👋',
    description: 'Hosts are responsible for cultivating a good atmosphere by welcoming and orienting new members, embodying the group culture and agreements, and helping members connect with relevant content and people.',
    responsibilities: ['Add Members']
  }
]

/** System responsibilities referenced by SYSTEM_ROLE_DEFINITIONS — schema.sql creates the table but no rows. */
const SYSTEM_RESPONSIBILITY_DEFINITIONS = [
  { title: 'Administration', description: 'Allows for editing group settings, exporting data, and deleting the group.' },
  { title: 'Add Members', description: 'The ability to invite and add new people to the group, and to accept or reject join requests.' },
  { title: 'Remove Members', description: 'The ability to remove a member from the group.' },
  { title: 'Manage Content', description: 'Adjust group topics, custom views and manage content that contradicts the agreements of the group.' },
  { title: 'Manage Tracks', description: 'Create and manage tracks in the group.' },
  { title: 'Manage Rounds', description: 'Create and manage funding rounds in the group.' }
]

/**
 * E2E loads schema.sql only (no Knex migrations), so responsibilities may be empty.
 * GroupSettings and other permission checks need these rows for Coordinator → Administration.
 */
async function ensureSystemResponsibilities (client, now) {
  for (const resp of SYSTEM_RESPONSIBILITY_DEFINITIONS) {
    await client.query(
      `INSERT INTO responsibilities (title, description, type, created_at, updated_at, group_id)
       SELECT $1, $2, 'system', $3::timestamptz, $3::timestamptz, NULL
       WHERE NOT EXISTS (
         SELECT 1 FROM responsibilities r WHERE r.title = $1 AND r.type = 'system'
       )`,
      [resp.title, resp.description, now]
    )
  }
}

/**
 * Create per-group system roles (Coordinator, Moderator, Host) if missing.
 * @returns {Promise<Record<string, number>>} role name → groups_roles.id
 */
async function setupSystemRolesForGroup (client, groupId, now) {
  const roleIds = {}
  for (const roleDef of SYSTEM_ROLE_DEFINITIONS) {
    let res = await client.query(
      `SELECT id FROM groups_roles WHERE group_id = $1 AND name = $2 AND type = 'system' LIMIT 1`,
      [groupId, roleDef.name]
    )
    let roleId = res.rows[0]?.id
    if (!roleId) {
      res = await client.query(
        `INSERT INTO groups_roles (group_id, name, emoji, description, type, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'system', true, $5::timestamptz, $5::timestamptz)
         RETURNING id`,
        [groupId, roleDef.name, roleDef.emoji, roleDef.description, now]
      )
      roleId = res.rows[0].id
    }
    for (const respTitle of roleDef.responsibilities) {
      await client.query(
        `INSERT INTO group_roles_responsibilities (group_role_id, responsibility_id)
         SELECT $1::bigint, r.id
         FROM responsibilities r
         WHERE r.title = $2 AND r.type = 'system'
         AND NOT EXISTS (
           SELECT 1 FROM group_roles_responsibilities grr
           WHERE grr.group_role_id = $1 AND grr.responsibility_id = r.id
         )`,
        [roleId, respTitle]
      )
    }
    roleIds[roleDef.name] = roleId
  }
  return roleIds
}

/** Assign the Coordinator system role to a membership. */
async function assignCoordinatorRole (client, userId, groupId, coordinatorRoleId, now) {
  await client.query(
    `INSERT INTO group_memberships_group_roles (user_id, group_id, group_role_id, active, created_at, updated_at)
     SELECT $1::bigint, $2::bigint, $3::bigint, true, $4::timestamptz, $4::timestamptz
     WHERE NOT EXISTS (
       SELECT 1 FROM group_memberships_group_roles mgr
       WHERE mgr.user_id = $1 AND mgr.group_id = $2 AND mgr.group_role_id = $3
     )`,
    [userId, groupId, coordinatorRoleId, now]
  )
}

const E2E_USER_EMAIL = 'e2e.user@hylo.test'
const E2E_USER_PASSWORD = 'e2e-password-123'
/** Logout / re-login Playwright only — keeps primary `e2e.user` session valid for parallel tests. */
const E2E_SESSION_MUTATE_EMAIL = 'e2e.session-mutate@hylo.test'
const E2E_STRIPE_ACCOUNT_EXTERNAL_ID = 'acct_e2e_public_group_001'
/** Member of `e2e-public-group` without Coordinator — sees track paywall (Batch P3 E2E). */
const E2E_TRACK_VIEWER_EMAIL = 'e2e.track-viewer@hylo.test'

const E2E_INVITE_LINK_GROUPS = [
  { slug: 'e2e-invite-hidden-closed', name: 'E2E Invite Hidden Closed', visibility: 0, accessibility: 0, token: 'e2e-invite-hc-001' },
  { slug: 'e2e-invite-hidden-restricted', name: 'E2E Invite Hidden Restricted', visibility: 0, accessibility: 1, token: 'e2e-invite-hr-001' },
  { slug: 'e2e-invite-protected-closed', name: 'E2E Invite Protected Closed', visibility: 1, accessibility: 0, token: 'e2e-invite-pc-001' },
  { slug: 'e2e-invite-protected-restricted', name: 'E2E Invite Protected Restricted', visibility: 1, accessibility: 1, token: 'e2e-invite-pr-001' },
  { slug: 'e2e-invite-public-closed', name: 'E2E Invite Public Closed', visibility: 2, accessibility: 0, token: 'e2e-invite-uc-001' },
  { slug: 'e2e-invite-token-group', name: 'E2E Invite Public Restricted', visibility: 2, accessibility: 1, token: 'e2e-static-invite-token-001' }
]

const E2E_JOIN_LINK_GROUPS = [
  { slug: 'e2e-join-hidden-closed', name: 'E2E Join Hidden Closed', visibility: 0, accessibility: 0, accessCode: 'e2ejohc001' },
  { slug: 'e2e-hidden-join-group', name: 'E2E Join Hidden Restricted', visibility: 0, accessibility: 1, accessCode: 'e2ehjco001' },
  { slug: 'e2e-join-protected-closed', name: 'E2E Join Protected Closed', visibility: 1, accessibility: 0, accessCode: 'e2ejopc001' },
  { slug: 'e2e-join-protected-restricted', name: 'E2E Join Protected Restricted', visibility: 1, accessibility: 1, accessCode: 'e2ejopr001' },
  { slug: 'e2e-join-code-group', name: 'E2E Join Public Closed', visibility: 2, accessibility: 0, accessCode: 'e2ejoincode001' },
  { slug: 'e2e-join-public-restricted', name: 'E2E Join Public Restricted', visibility: 2, accessibility: 1, accessCode: 'e2ejpubr001' }
]

const E2E_GROUP_SLUGS = [
  'e2e-public-group',
  'e2e-private-group',
  'e2e-paywall-group',
  'e2e-welcome-overlay',
  ...E2E_JOIN_LINK_GROUPS.map((g) => g.slug),
  ...E2E_INVITE_LINK_GROUPS.map((g) => g.slug)
]

const E2E_USER_EMAILS = [
  E2E_USER_EMAIL,
  E2E_SESSION_MUTATE_EMAIL,
  E2E_TRACK_VIEWER_EMAIL,
  'e2e.join-host@hylo.test'
].map((email) => email.toLowerCase())

const E2E_INVITE_TOKENS = E2E_INVITE_LINK_GROUPS.map((g) => g.token)

/**
 * Removes rows from a previous full or partial seed so the script is safe to re-run.
 */
async function clearPreviousE2eBaseline (client) {
  await client.query(
    `DELETE FROM group_invites
     WHERE token = ANY($1::text[])
        OR group_id IN (SELECT id FROM groups WHERE slug = ANY($2::text[]))`,
    [E2E_INVITE_TOKENS, E2E_GROUP_SLUGS]
  )

  await client.query(
    `DELETE FROM stripe_products
     WHERE group_id IN (SELECT id FROM groups WHERE slug = ANY($1::text[]))
        OR stripe_product_id LIKE 'prod_e2e_%'`,
    [E2E_GROUP_SLUGS]
  )

  await client.query(
    `DELETE FROM groups_tracks
     WHERE track_id IN (SELECT id FROM tracks WHERE name = 'E2E Paid Track')
        OR group_id IN (SELECT id FROM groups WHERE slug = ANY($1::text[]))`,
    [E2E_GROUP_SLUGS]
  )

  await client.query(`DELETE FROM tracks WHERE name = 'E2E Paid Track'`)

  await client.query(
    `DELETE FROM groups_posts
     WHERE post_id IN (SELECT id FROM posts WHERE name = 'E2E Public Post')
        OR group_id IN (SELECT id FROM groups WHERE slug = ANY($1::text[]))`,
    [E2E_GROUP_SLUGS]
  )

  await client.query(`DELETE FROM posts WHERE name = 'E2E Public Post'`)

  await client.query(
    `DELETE FROM group_memberships_group_roles
     WHERE group_id IN (SELECT id FROM groups WHERE slug = ANY($1::text[]))
        OR user_id IN (SELECT id FROM users WHERE lower(email) = ANY($2::text[]))`,
    [E2E_GROUP_SLUGS, E2E_USER_EMAILS]
  )

  await client.query(
    `DELETE FROM group_memberships
     WHERE group_id IN (SELECT id FROM groups WHERE slug = ANY($1::text[]))
        OR user_id IN (SELECT id FROM users WHERE lower(email) = ANY($2::text[]))`,
    [E2E_GROUP_SLUGS, E2E_USER_EMAILS]
  )

  await client.query(
    `UPDATE groups SET stripe_account_id = NULL WHERE slug = ANY($1::text[])`,
    [E2E_GROUP_SLUGS]
  )

  await client.query(`DELETE FROM groups WHERE slug = ANY($1::text[])`, [E2E_GROUP_SLUGS])

  await client.query(
    `DELETE FROM linked_account
     WHERE user_id IN (SELECT id FROM users WHERE lower(email) = ANY($1::text[]))`,
    [E2E_USER_EMAILS]
  )

  await client.query(`DELETE FROM users WHERE lower(email) = ANY($1::text[])`, [E2E_USER_EMAILS])

  await client.query(
    `DELETE FROM stripe_accounts WHERE stripe_account_external_id = $1`,
    [E2E_STRIPE_ACCOUNT_EXTERNAL_ID]
  )
}

async function main () {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('[seed-e2e-baseline] DATABASE_URL is required')
    process.exit(1)
  }

  assertSafeE2eDatabase(connectionString)
  const dbName = databaseNameFromUrl(connectionString)
  console.log(`[seed-e2e-baseline] seeding database: ${dbName}`)

  const sslMode = (process.env.PGSSLMODE || 'disable').toLowerCase()
  const useSsl =
    sslMode === 'require' ||
    sslMode === 'verify-full' ||
    sslMode === 'verify-ca'
  const client = new Client({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  })
  await client.connect()
  const seedInstantMs = Date.now()
  const now = new Date(seedInstantMs).toISOString()
  await ensureSystemResponsibilities(client, now)
  const userSettings = JSON.stringify({ locale: 'en' })
  const emptyGroupSettings = JSON.stringify({})

  /**
   * Membership.settings.lastReadAt → GraphQL Membership.lastViewedAt; clients order by desc for “last group”.
   * Keep `e2e.user` public + private strictly newer than paywall / welcome so `GET /` is deterministic for Batch A.
   *
   * `GroupWelcomeModal` shows when `showJoinForm || agreementsChanged || !joinQuestionsAnsweredAt` — so every
   * “normal” membership must set `joinQuestionsAnsweredAt` (and clear `showJoinForm`) or the modal blocks most E2E.
   * Batch M uses `e2e-welcome-overlay` only, with `showJoinForm: true` there.
   */
  const membershipSettingsWelcomeCleared = (lastReadAtMs) =>
    JSON.stringify({
      lastReadAt: new Date(lastReadAtMs).toISOString(),
      showJoinForm: false,
      joinQuestionsAnsweredAt: now,
      agreementsAcceptedAt: now
    })
  const membershipSettings = membershipSettingsWelcomeCleared(seedInstantMs - 86400000)
  const membershipSettingsPrimaryLastViewed = membershipSettingsWelcomeCleared(seedInstantMs + 86400000)

  try {
    await client.query('BEGIN')

    await clearPreviousE2eBaseline(client)

    const userRes = await client.query(
      `INSERT INTO users (email, name, first_name, last_name, active, email_validated, created_at, updated_at, settings)
       VALUES ($1, $2, $3, $4, true, true, $5::timestamptz, $5::timestamptz, $6::jsonb)
       RETURNING id`,
      [E2E_USER_EMAIL.toLowerCase(), 'E2E User', 'E2E', 'User', now, userSettings]
    )
    const userId = userRes.rows[0].id

    /** Host-only membership so `e2e.user` can exercise join links (Batch L E2E). */
    const hostRes = await client.query(
      `INSERT INTO users (email, name, first_name, last_name, active, email_validated, created_at, updated_at, settings)
       VALUES ($1, $2, $3, $4, true, true, $5::timestamptz, $5::timestamptz, $6::jsonb)
       RETURNING id`,
      ['e2e.join-host@hylo.test', 'E2E Join Host', 'E2E', 'Host', now, userSettings]
    )
    const hostId = hostRes.rows[0].id

    const pubRes = await client.query(
      `INSERT INTO groups (
        active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public
      ) VALUES (
        true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        2, 1, $5, $6::jsonb, 1, true
      ) RETURNING id`,
      [now, 'E2E Public Group', 'e2e-public-group', 'Deterministic public group for Playwright E2E', userId, emptyGroupSettings]
    )
    const publicGroupId = pubRes.rows[0].id

    const privRes = await client.query(
      `INSERT INTO groups (
        active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public
      ) VALUES (
        true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        0, 1, $5, $6::jsonb, 1, false
      ) RETURNING id`,
      [now, 'E2E Private Group', 'e2e-private-group', 'Deterministic private group for Playwright E2E', userId, emptyGroupSettings]
    )
    const privateGroupId = privRes.rows[0].id

    const publicRoles = await setupSystemRolesForGroup(client, publicGroupId, now)
    const privateRoles = await setupSystemRolesForGroup(client, privateGroupId, now)

    // Maps to Membership.lastViewedAt; without it AuthLayoutRouter replaces deep links with …/stream
    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, created_at, updated_at, settings)
       VALUES ($1, $2, true, $3::timestamptz, $3::timestamptz, $4::jsonb),
              ($5, $2, true, $3::timestamptz, $3::timestamptz, $6::jsonb)`,
      [publicGroupId, userId, now, membershipSettingsPrimaryLastViewed, privateGroupId, membershipSettingsPrimaryLastViewed]
    )
    await assignCoordinatorRole(client, userId, publicGroupId, publicRoles.Coordinator, now)
    await assignCoordinatorRole(client, userId, privateGroupId, privateRoles.Coordinator, now)

    const stripeAccountRes = await client.query(
      `INSERT INTO stripe_accounts (stripe_account_external_id)
       VALUES ($1)
       RETURNING id`,
      [E2E_STRIPE_ACCOUNT_EXTERNAL_ID]
    )
    const stripeAccountId = stripeAccountRes.rows[0].id

    await client.query(
      `UPDATE groups
       SET stripe_account_id = $1,
           stripe_charges_enabled = true,
           stripe_payouts_enabled = true,
           stripe_details_submitted = true
       WHERE id = $2`,
      [stripeAccountId, publicGroupId]
    )

    /** Public paywall group — Batch P2/P5/P6; `e2e.user` is a plain member (no Coordinator) for stream paywall */
    const paywallRes = await client.query(
      `INSERT INTO groups (
        active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public, paywall
      ) VALUES (
        true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        2, 1, $5, $6::jsonb, 1, true, true
      ) RETURNING id`,
      [
        now,
        'E2E Paywall Group',
        'e2e-paywall-group',
        'Deterministic paywall group for Playwright Batch P2',
        userId,
        emptyGroupSettings
      ]
    )
    const paywallGroupId = paywallRes.rows[0].id
    await setupSystemRolesForGroup(client, paywallGroupId, now)

    await client.query(
      `UPDATE groups
       SET stripe_account_id = $1,
           stripe_charges_enabled = true,
           stripe_payouts_enabled = true,
           stripe_details_submitted = true
       WHERE id = $2`,
      [stripeAccountId, paywallGroupId]
    )

    await client.query(
      `INSERT INTO stripe_products (
        group_id,
        stripe_product_id,
        stripe_price_id,
        name,
        description,
        price_in_cents,
        currency,
        access_grants,
        renewal_policy,
        duration,
        publish_status,
        created_at,
        updated_at
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'usd',
        $7::jsonb,
        'automatic',
        'month',
        'published',
        $8::timestamptz,
        $8::timestamptz
      )`,
      [
        paywallGroupId,
        'prod_e2e_paywall_stream_001',
        'price_e2e_paywall_stream_001',
        'E2E Paywall Stream Monthly',
        'Deterministic paywall offering for public discovery E2E',
        1500,
        JSON.stringify({ groupIds: [paywallGroupId] }),
        now
      ]
    )

    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, created_at, updated_at, settings)
       VALUES ($1, $2, true, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [paywallGroupId, userId, now, membershipSettings]
    )

    await client.query(
      `INSERT INTO stripe_products (
        group_id,
        stripe_product_id,
        stripe_price_id,
        name,
        description,
        price_in_cents,
        currency,
        access_grants,
        renewal_policy,
        duration,
        publish_status,
        created_at,
        updated_at
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'usd',
        $7::jsonb,
        'automatic',
        'month',
        'published',
        $8::timestamptz,
        $8::timestamptz
      )`,
      [
        publicGroupId,
        'prod_e2e_public_group_001',
        'price_e2e_public_group_001',
        'E2E Membership Monthly',
        'Deterministic monthly membership offering for Paid Content E2E',
        1200,
        JSON.stringify({ groupIds: [publicGroupId] }),
        now
      ]
    )

    /** Access-controlled published track + offering granting track scope (Batch P3). Coordinators bypass paywall; use `e2e.track-viewer@hylo.test`. */
    const paidTrackRes = await client.query(
      `INSERT INTO tracks (
        name, description, published_at, access_controlled,
        action_descriptor, action_descriptor_plural,
        created_at, updated_at, settings
      ) VALUES (
        'E2E Paid Track',
        '<p>Deterministic paid track for Batch P3 E2E</p>',
        $1::timestamptz,
        true,
        'Action',
        'Actions',
        $1::timestamptz,
        $1::timestamptz,
        '{}'::jsonb
      ) RETURNING id`,
      [now]
    )
    const paidTrackId = paidTrackRes.rows[0].id

    await client.query(
      `INSERT INTO groups_tracks (track_id, group_id, created_at, updated_at)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz)`,
      [paidTrackId, publicGroupId, now]
    )

    await client.query(
      `INSERT INTO stripe_products (
        group_id,
        stripe_product_id,
        stripe_price_id,
        name,
        description,
        price_in_cents,
        currency,
        access_grants,
        renewal_policy,
        duration,
        publish_status,
        created_at,
        updated_at
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'usd',
        $7::jsonb,
        'automatic',
        'month',
        'published',
        $8::timestamptz,
        $8::timestamptz
      )`,
      [
        publicGroupId,
        'prod_e2e_track_access_001',
        'price_e2e_track_access_001',
        'E2E Track Access Monthly',
        'Offering that grants access to the Batch P3 seeded track',
        900,
        JSON.stringify({ trackIds: [paidTrackId] }),
        now
      ]
    )

    /**
     * GroupSettings requires Coordinator → Administration (`getResponsibilitiesForGroup`).
     * Raw `group_memberships` inserts do not run GroupMembership.assignCoordinatorRole.
     */
    const welcomeOverlayMembershipSettings = JSON.stringify({
      lastReadAt: new Date(seedInstantMs - 43200000).toISOString(),
      showJoinForm: true
    })
    const welcomeRes = await client.query(
      `INSERT INTO groups (
        active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public
      ) VALUES (
        true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        2, 2, $5, $6::jsonb, 1, true
      ) RETURNING id`,
      [now, 'E2E Welcome Overlay', 'e2e-welcome-overlay', 'Playwright GroupWelcomeModal E2E', userId, emptyGroupSettings]
    )
    const welcomeGroupId = welcomeRes.rows[0].id
    const welcomeRoles = await setupSystemRolesForGroup(client, welcomeGroupId, now)

    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, created_at, updated_at, settings)
       VALUES ($1, $2, true, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [welcomeGroupId, userId, now, welcomeOverlayMembershipSettings]
    )

    await assignCoordinatorRole(client, userId, welcomeGroupId, welcomeRoles.Coordinator, now)

    const mutateUserRes = await client.query(
      `INSERT INTO users (email, name, first_name, last_name, active, email_validated, created_at, updated_at, settings)
       VALUES ($1, $2, $3, $4, true, true, $5::timestamptz, $5::timestamptz, $6::jsonb)
       RETURNING id`,
      [E2E_SESSION_MUTATE_EMAIL.toLowerCase(), 'E2E Session Mutate', 'E2E', 'Mutate', now, userSettings]
    )
    const sessionMutateUserId = mutateUserRes.rows[0].id
    const sessionMutateMembershipSettings = membershipSettingsWelcomeCleared(seedInstantMs + 7200000)

    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, created_at, updated_at, settings)
       VALUES ($1, $2, true, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [publicGroupId, sessionMutateUserId, now, sessionMutateMembershipSettings]
    )

    await assignCoordinatorRole(client, sessionMutateUserId, publicGroupId, publicRoles.Coordinator, now)

    const mutatePasswordHash = await bcrypt.hash(E2E_USER_PASSWORD, 10)
    await client.query(
      `INSERT INTO linked_account (user_id, provider_user_id, provider_key)
       VALUES ($1, $2, 'password')`,
      [sessionMutateUserId, mutatePasswordHash]
    )

    const postRes = await client.query(
      `INSERT INTO posts (name, description, type, created_at, updated_at, user_id, active, visibility, is_public)
       VALUES ($1, $2, 'discussion', $3::timestamptz, $3::timestamptz, $4, true, 0, true)
       RETURNING id`,
      ['E2E Public Post', 'Deterministic public post for unauthenticated route tests', now, userId]
    )
    const publicPostId = postRes.rows[0].id

    await client.query(
      'INSERT INTO groups_posts (post_id, group_id) VALUES ($1, $2)',
      [publicPostId, publicGroupId]
    )

    /** Groups + posts for Playwright post-detail close navigation (see apps/web/e2e/authenticated.post-detail.spec.js). */
    const outsiderGroupRes = await client.query(
      `INSERT INTO groups (
        active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public
      ) VALUES (
        true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        2, 1, $5, $6::jsonb, 1, true
      ) RETURNING id`,
      [now, 'E2E Outsider Group', 'e2e-outsider-only', 'E2E: main user is not a member', hostId, emptyGroupSettings]
    )
    const outsiderGroupId = outsiderGroupRes.rows[0].id

    const extrPubARes = await client.query(
      `INSERT INTO groups (
        active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public
      ) VALUES (
        true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        2, 1, $5, $6::jsonb, 1, true
      ) RETURNING id`,
      [now, 'E2E NoMember Public A', 'e2e-nomember-a', 'E2E dual-group public post (host only)', hostId, emptyGroupSettings]
    )
    const extrPubAId = extrPubARes.rows[0].id

    const extrPubBRes = await client.query(
      `INSERT INTO groups (
        active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public
      ) VALUES (
        true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        2, 1, $5, $6::jsonb, 1, true
      ) RETURNING id`,
      [now, 'E2E NoMember Public B', 'e2e-nomember-b', 'E2E dual-group public post (host only)', hostId, emptyGroupSettings]
    )
    const extrPubBId = extrPubBRes.rows[0].id

    const outsiderRoles = await setupSystemRolesForGroup(client, outsiderGroupId, now)
    const extrPubARoles = await setupSystemRolesForGroup(client, extrPubAId, now)
    const extrPubBRoles = await setupSystemRolesForGroup(client, extrPubBId, now)

    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, created_at, updated_at, settings)
       VALUES ($1, $2, true, $3::timestamptz, $3::timestamptz, $4::jsonb),
              ($5, $2, true, $3::timestamptz, $3::timestamptz, $4::jsonb),
              ($6, $2, true, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [outsiderGroupId, hostId, now, membershipSettings, extrPubAId, extrPubBId]
    )

    for (const [gid, coordinatorRoleId] of [
      [outsiderGroupId, outsiderRoles.Coordinator],
      [extrPubAId, extrPubARoles.Coordinator],
      [extrPubBId, extrPubBRoles.Coordinator]
    ]) {
      await assignCoordinatorRole(client, hostId, gid, coordinatorRoleId, now)
    }

    const postMultiPublicRes = await client.query(
      `INSERT INTO posts (name, description, type, created_at, updated_at, user_id, active, visibility, is_public)
       VALUES ($1, $2, 'discussion', $3::timestamptz, $3::timestamptz, $4, true, 0, true)
       RETURNING id`,
      ['E2E Multi Public Post', 'Dual-group public post for close → /public/stream', now, userId]
    )
    const postMultiPublicId = postMultiPublicRes.rows[0].id
    await client.query(
      'INSERT INTO groups_posts (post_id, group_id) VALUES ($1, $2), ($1, $3)',
      [postMultiPublicId, extrPubAId, extrPubBId]
    )

    const postOneMemberMultiRes = await client.query(
      `INSERT INTO posts (name, description, type, created_at, updated_at, user_id, active, visibility, is_public)
       VALUES ($1, $2, 'discussion', $3::timestamptz, $3::timestamptz, $4, true, 0, true)
       RETURNING id`,
      ['E2E One-Member Multi Post', 'Member of one of two groups → that group stream', now, userId]
    )
    const postOneMemberMultiId = postOneMemberMultiRes.rows[0].id
    await client.query(
      'INSERT INTO groups_posts (post_id, group_id) VALUES ($1, $2), ($1, $3)',
      [postOneMemberMultiId, publicGroupId, outsiderGroupId]
    )

    const postMultiMemberRes = await client.query(
      `INSERT INTO posts (name, description, type, created_at, updated_at, user_id, active, visibility, is_public)
       VALUES ($1, $2, 'discussion', $3::timestamptz, $3::timestamptz, $4, true, 0, true)
       RETURNING id`,
      ['E2E Multi Member Post', 'Member of both groups → /my/groups', now, userId]
    )
    const postMultiMemberId = postMultiMemberRes.rows[0].id
    await client.query(
      'INSERT INTO groups_posts (post_id, group_id) VALUES ($1, $2), ($1, $3)',
      [postMultiMemberId, publicGroupId, privateGroupId]
    )

    const nogroupsUserRes = await client.query(
      `INSERT INTO users (email, name, first_name, last_name, active, email_validated, created_at, updated_at, settings)
       VALUES ($1, $2, $3, $4, true, true, $5::timestamptz, $5::timestamptz, $6::jsonb)
       RETURNING id`,
      ['e2e.nogroups@hylo.test'.toLowerCase(), 'E2E No Groups', 'E2E', 'NoGroups', now, userSettings]
    )
    const nogroupsUserId = nogroupsUserRes.rows[0].id

    /** Batch Q — join / invite link matrix (Closed + Restricted only; no Open). */
    const invitationLinkGroupIds = []

    for (const groupDef of E2E_JOIN_LINK_GROUPS) {
      const res = await client.query(
        `INSERT INTO groups (
          active, created_at, updated_at, name, slug, description,
          visibility, accessibility, created_by_id, settings, num_members, allow_in_public, access_code
        ) VALUES (
          true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
          $5, $6, $7, $8::jsonb, 1, $9, $10
        ) RETURNING id`,
        [
          now,
          groupDef.name,
          groupDef.slug,
          `Playwright E2E — join link (${groupDef.slug})`,
          groupDef.visibility,
          groupDef.accessibility,
          hostId,
          emptyGroupSettings,
          groupDef.visibility === 2,
          groupDef.accessCode
        ]
      )
      invitationLinkGroupIds.push(res.rows[0].id)
    }

    for (const groupDef of E2E_INVITE_LINK_GROUPS) {
      const res = await client.query(
        `INSERT INTO groups (
          active, created_at, updated_at, name, slug, description,
          visibility, accessibility, created_by_id, settings, num_members, allow_in_public
        ) VALUES (
          true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
          $5, $6, $7, $8::jsonb, 1, $9
        ) RETURNING id`,
        [
          now,
          groupDef.name,
          groupDef.slug,
          `Playwright E2E — invite link (${groupDef.slug})`,
          groupDef.visibility,
          groupDef.accessibility,
          hostId,
          emptyGroupSettings,
          groupDef.visibility === 2
        ]
      )
      const groupId = res.rows[0].id
      invitationLinkGroupIds.push(groupId)
      await client.query(
        `INSERT INTO group_invites (created_at, invited_by_id, token, email, group_id)
         VALUES ($1::timestamptz, $2, $3, $4, $5)`,
        [now, hostId, groupDef.token, E2E_USER_EMAIL.toLowerCase(), groupId]
      )
    }

    for (const groupId of invitationLinkGroupIds) {
      const roles = await setupSystemRolesForGroup(client, groupId, now)
      await client.query(
        `INSERT INTO group_memberships (group_id, user_id, active, created_at, updated_at, settings)
         VALUES ($1, $2, true, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
        [groupId, hostId, now, membershipSettings]
      )
      await assignCoordinatorRole(client, hostId, groupId, roles.Coordinator, now)
    }

    const passwordHash = await bcrypt.hash(E2E_USER_PASSWORD, 10)
    await client.query(
      `INSERT INTO linked_account (user_id, provider_user_id, provider_key)
       VALUES ($1, $2, 'password')`,
      [userId, passwordHash]
    )
    await client.query(
      `INSERT INTO linked_account (user_id, provider_user_id, provider_key)
       VALUES ($1, $2, 'password')`,
      [nogroupsUserId, passwordHash]
    )

    const trackViewerRes = await client.query(
      `INSERT INTO users (email, name, first_name, last_name, active, email_validated, created_at, updated_at, settings)
       VALUES ($1, $2, $3, $4, true, true, $5::timestamptz, $5::timestamptz, $6::jsonb)
       RETURNING id`,
      [
        E2E_TRACK_VIEWER_EMAIL.toLowerCase(),
        'E2E Track Viewer',
        'E2E',
        'Viewer',
        now,
        userSettings
      ]
    )
    const trackViewerId = trackViewerRes.rows[0].id

    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, created_at, updated_at, settings)
       VALUES ($1, $2, true, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [publicGroupId, trackViewerId, now, membershipSettings]
    )

    await client.query(
      `INSERT INTO linked_account (user_id, provider_user_id, provider_key)
       VALUES ($1, $2, 'password')`,
      [trackViewerId, passwordHash]
    )

    await client.query('COMMIT')
    // schema.sql defines search_index WITH NO DATA; GraphQL search fails until refreshed
    await client.query('REFRESH MATERIALIZED VIEW search_index')
    console.log('[seed-e2e-baseline] ok')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('[seed-e2e-baseline]', err)
  process.exit(1)
})
