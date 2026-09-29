/**
 * Give existing top-level groups the "Who can add new members?" policy decided
 * for them once member invitations are switched on. It only concerns groups
 * still on stewards, meaning none of their active roles is linked to the
 * system Invite Members responsibility:
 * - Open groups get their Member role linked, so everyone can invite.
 * - Restricted and Closed groups get their Moderator role linked, because
 *   stewards now means Administrators, Moderators and Hosts.
 * Groups already on everyone or specific roles are left alone.
 *
 * While member invitations are switched off nothing is linked at all (see
 * GroupRole.setInvitePolicy), so groups created in the meantime are still on
 * stewards with no link and are converted here too.
 *
 * Migration 20261003000000 runs this itself where member invitations are
 * already on. Where they are off (production today), run it once right after
 * switching FEATURE_FLAG_MEMBER_INVITES on:
 *
 *   NODE_ENV=production node migrations/scripts/convertInvitePolicies.js
 *
 * Groups are handled in batches by id, and each batch commits on its own, so a
 * run that stops part way can simply be run again. Every link this adds is
 * recorded in invite_policy_migration_links, and the migration's down()
 * removes only those. Member roles created here for Open groups that lacked
 * one are kept.
 */

const INVITE_MEMBERS = 'Invite Members'
const TRACKING_TABLE = 'invite_policy_migration_links'
const BATCH_SIZE = 500
const OPEN = 2
const MEMBER_ROLE_NAME = 'Member'
const MEMBER_ROLE_DESCRIPTION = 'Everyone in the group holds this role.'

/**
 * Whether member invitations are switched on, by the same rule as
 * isFeatureEnabled(MEMBER_INVITES) in lib/featureFlags.js, which this plain
 * CommonJS file cannot import. A test keeps the two in step.
 */
function memberInvitesOn (env = process.env) {
  const value = String(env.FEATURE_FLAG_MEMBER_INVITES || '').trim().toLowerCase()
  if (value === 'on' || value === 'true') return true
  if (value === 'off' || value === 'false') return false
  const environment = env.SENTRY_ENV || env.NODE_ENV
  return ['development', 'test', 'staging'].includes(environment)
}

// Groups in this batch with no active role linked to Invite Members
const onStewardsSql = `
  g.id = ANY(?)
  AND g.parent_id IS NULL
  AND g.type IS DISTINCT FROM 'space'
  AND NOT EXISTS (
    SELECT 1 FROM groups_roles linked
    JOIN group_roles_responsibilities grr ON grr.group_role_id = linked.id AND grr.responsibility_id = ?
    WHERE linked.group_id = g.id AND linked.active = true
  )`

async function convertBatch (knex, groupIds, inviteMembersId) {
  const now = new Date()

  // The ON CONFLICT predicate must be a literal to match the partial unique index
  await knex.raw(`
    INSERT INTO groups_roles (group_id, name, emoji, description, type, active, created_at, updated_at)
    SELECT g.id, ?, '', ?, 'member', true, ?, ?
    FROM groups g
    WHERE ${onStewardsSql} AND g.accessibility = ?
    ON CONFLICT (group_id) WHERE type = 'member' DO NOTHING
  `, [MEMBER_ROLE_NAME, MEMBER_ROLE_DESCRIPTION, now, now, groupIds, inviteMembersId, OPEN])

  await knex.raw(`
    WITH targets AS (
      SELECT DISTINCT ON (g.id) gr.id AS group_role_id
      FROM groups g
      JOIN groups_roles gr ON gr.group_id = g.id AND gr.active = true
      WHERE ${onStewardsSql}
        AND (
          (g.accessibility = ? AND gr.type = 'member')
          OR (g.accessibility IS DISTINCT FROM ? AND gr.type = 'system' AND gr.name = 'Moderator')
        )
      ORDER BY g.id, gr.id
    ),
    inserted AS (
      INSERT INTO group_roles_responsibilities (group_role_id, responsibility_id)
      SELECT group_role_id, ? FROM targets
      RETURNING id
    )
    INSERT INTO ${TRACKING_TABLE} (group_role_responsibility_id, created_at)
    SELECT id, ? FROM inserted
  `, [groupIds, inviteMembersId, OPEN, OPEN, inviteMembersId, now])
}

async function ensureTrackingTable (knex) {
  if (await knex.schema.hasTable(TRACKING_TABLE)) return
  await knex.schema.createTable(TRACKING_TABLE, table => {
    table.bigInteger('group_role_responsibility_id').primary()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
}

/**
 * Link Member (Open groups) or Moderator (Restricted and Closed groups) to
 * Invite Members in every top-level group still on stewards.
 */
async function convertInvitePolicies (knex) {
  await ensureTrackingTable(knex)

  const inviteMembers = await knex('responsibilities')
    .where({ title: INVITE_MEMBERS, type: 'system' })
    .whereNull('group_id')
    .orderBy('id', 'asc')
    .first('id')
  if (!inviteMembers) return

  let lastId = 0
  for (;;) {
    const ids = await knex('groups')
      .where('id', '>', lastId)
      .whereNull('parent_id')
      .whereRaw("type IS DISTINCT FROM 'space'")
      .orderBy('id', 'asc')
      .limit(BATCH_SIZE)
      .pluck('id')
    if (ids.length === 0) break
    lastId = ids[ids.length - 1]
    await convertBatch(knex, ids.map(Number), inviteMembers.id)
  }
}

/**
 * Remove exactly the links convertInvitePolicies added, and its tracking table.
 */
async function revertInvitePolicyConversion (knex) {
  if (!(await knex.schema.hasTable(TRACKING_TABLE))) return
  await knex('group_roles_responsibilities')
    .whereIn('id', knex(TRACKING_TABLE).select('group_role_responsibility_id'))
    .del()
  await knex.schema.dropTable(TRACKING_TABLE)
}

module.exports = {
  TRACKING_TABLE,
  memberInvitesOn,
  ensureTrackingTable,
  convertInvitePolicies,
  revertInvitePolicyConversion
}

async function main () {
  const environment = process.env.NODE_ENV || 'development'
  const config = require('../../knexfile')[environment]
  const knex = require('knex')(config)
  try {
    if (!memberInvitesOn()) {
      console.error('Member invitations are switched off here. Switch FEATURE_FLAG_MEMBER_INVITES on first, then run this again.')
      process.exitCode = 1
      return
    }
    await convertInvitePolicies(knex)
    console.info('Invite policies converted.')
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    await knex.destroy()
  }
}

if (require.main === module) main()
