/**
 * Minimal deterministic E2E data using a single pg connection (avoids Knex pool issues during isolated runs).
 * Expects DATABASE_URL (same as backend).
 */
const { Client } = require('pg')
const bcrypt = require('bcrypt')

const E2E_USER_EMAIL = 'e2e.user@hylo.test'
const E2E_USER_PASSWORD = 'e2e-password-123'
/** Logout / re-login Playwright only — keeps primary `e2e.user` session valid for parallel tests. */
const E2E_SESSION_MUTATE_EMAIL = 'e2e.session-mutate@hylo.test'

async function main () {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('[seed-e2e-baseline] DATABASE_URL is required')
    process.exit(1)
  }

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
  const now = new Date().toISOString()
  const userSettings = JSON.stringify({ locale: 'en' })
  const emptyGroupSettings = JSON.stringify({})

  try {
    await client.query('BEGIN')

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

    // Maps to Membership.lastViewedAt; without it AuthLayoutRouter replaces deep links with …/stream
    const membershipSettings = JSON.stringify({ lastReadAt: now })
    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, role, created_at, updated_at, settings)
       VALUES ($1, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb),
              ($5, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [publicGroupId, userId, now, membershipSettings, privateGroupId]
    )

    /**
     * GroupSettings requires Coordinator → Administration (`getResponsibilitiesForGroup`).
     * Raw `group_memberships` inserts do not run `MemberCommonRole.updateCoordinatorRole`.
     */
    let coordinatorRoleId = (await client.query(
      'SELECT id FROM common_roles WHERE name = \'Coordinator\' LIMIT 1'
    )).rows[0]?.id
    if (!coordinatorRoleId) {
      const cr = await client.query(
        `INSERT INTO common_roles (name, description, emoji, created_at, updated_at)
         VALUES ('Coordinator', $1, '🪄', $2::timestamptz, $2::timestamptz)
         RETURNING id`,
        [
          'Coordinators are empowered to do everything related to group administration.',
          now
        ]
      )
      coordinatorRoleId = cr.rows[0].id
    }

    let administrationRespId = (await client.query(
      'SELECT id FROM responsibilities WHERE title = \'Administration\' LIMIT 1'
    )).rows[0]?.id
    if (!administrationRespId) {
      const rr = await client.query(
        `INSERT INTO responsibilities (title, description, type, created_at, updated_at, group_id)
         VALUES ('Administration', $1, 'system', $2::timestamptz, $2::timestamptz, NULL)
         RETURNING id`,
        ['Full group administration', now]
      )
      administrationRespId = rr.rows[0].id
    }

    await client.query(
      `INSERT INTO common_roles_responsibilities (common_role_id, responsibility_id)
       SELECT $1::bigint, $2::bigint
       WHERE NOT EXISTS (
         SELECT 1 FROM common_roles_responsibilities
         WHERE common_role_id = $1 AND responsibility_id = $2
       )`,
      [coordinatorRoleId, administrationRespId]
    )

    /** `showJoinForm` opens `GroupWelcomeModal` for Batch M Playwright (do not use this slug for “clean stream” tests). */
    const welcomeOverlayMembershipSettings = JSON.stringify({ lastReadAt: now, showJoinForm: true })
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

    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, role, created_at, updated_at, settings)
       VALUES ($1, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [welcomeGroupId, userId, now, welcomeOverlayMembershipSettings]
    )

    for (const gid of [publicGroupId, privateGroupId, welcomeGroupId]) {
      await client.query(
        `INSERT INTO group_memberships_common_roles (user_id, group_id, common_role_id)
         SELECT $1::bigint, $2::bigint, $3::bigint
         WHERE NOT EXISTS (
           SELECT 1 FROM group_memberships_common_roles gmcr
           WHERE gmcr.user_id = $1 AND gmcr.group_id = $2 AND gmcr.common_role_id = $3
         )`,
        [userId, gid, coordinatorRoleId]
      )
    }

    const mutateUserRes = await client.query(
      `INSERT INTO users (email, name, first_name, last_name, active, email_validated, created_at, updated_at, settings)
       VALUES ($1, $2, $3, $4, true, true, $5::timestamptz, $5::timestamptz, $6::jsonb)
       RETURNING id`,
      [E2E_SESSION_MUTATE_EMAIL.toLowerCase(), 'E2E Session Mutate', 'E2E', 'Mutate', now, userSettings]
    )
    const sessionMutateUserId = mutateUserRes.rows[0].id

    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, role, created_at, updated_at, settings)
       VALUES ($1, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [publicGroupId, sessionMutateUserId, now, membershipSettings]
    )

    await client.query(
      `INSERT INTO group_memberships_common_roles (user_id, group_id, common_role_id)
       SELECT $1::bigint, $2::bigint, $3::bigint
       WHERE NOT EXISTS (
         SELECT 1 FROM group_memberships_common_roles gmcr
         WHERE gmcr.user_id = $1 AND gmcr.group_id = $2 AND gmcr.common_role_id = $3
       )`,
      [sessionMutateUserId, publicGroupId, coordinatorRoleId]
    )

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

    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, role, created_at, updated_at, settings)
       VALUES ($1, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb),
              ($5, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb),
              ($6, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [outsiderGroupId, hostId, now, membershipSettings, extrPubAId, extrPubBId]
    )

    for (const gid of [outsiderGroupId, extrPubAId, extrPubBId]) {
      await client.query(
        `INSERT INTO group_memberships_common_roles (user_id, group_id, common_role_id)
         SELECT $1::bigint, $2::bigint, $3::bigint
         WHERE NOT EXISTS (
           SELECT 1 FROM group_memberships_common_roles gmcr
           WHERE gmcr.user_id = $1 AND gmcr.group_id = $2 AND gmcr.common_role_id = $3
         )`,
        [hostId, gid, coordinatorRoleId]
      )
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

    const joinCodeGroupRes = await client.query(
      `INSERT INTO groups (
        active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public, access_code
      ) VALUES (
        true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        2, 2, $5, $6::jsonb, 1, true, $7
      ) RETURNING id`,
      [
        now,
        'E2E Join Code Group',
        'e2e-join-code-group',
        'Playwright E2E — join via /groups/:slug/join/:accessCode',
        hostId,
        emptyGroupSettings,
        'e2ejoincode001'
      ]
    )
    const joinCodeGroupId = joinCodeGroupRes.rows[0].id

    const inviteTokenGroupRes = await client.query(
      `INSERT INTO groups (
        active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public
      ) VALUES (
        true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        2, 2, $5, $6::jsonb, 1, true
      ) RETURNING id`,
      [
        now,
        'E2E Invite Token Group',
        'e2e-invite-token-group',
        'Playwright E2E — join via /h/use-invitation?token=…',
        hostId,
        emptyGroupSettings
      ]
    )
    const inviteTokenGroupId = inviteTokenGroupRes.rows[0].id

    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, role, created_at, updated_at, settings)
       VALUES ($1, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb),
              ($5, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [joinCodeGroupId, hostId, now, membershipSettings, inviteTokenGroupId]
    )

    await client.query(
      `INSERT INTO group_invites (created_at, invited_by_id, token, email, group_id)
       VALUES ($1::timestamptz, $2, $3, $4, $5)`,
      [now, hostId, 'e2e-static-invite-token-001', E2E_USER_EMAIL.toLowerCase(), inviteTokenGroupId]
    )

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
