/**
 * Ensure every group has the full set of common views that belong in More Views
 * when not in the menu: post-type streams, map, members, moderation,
 * related-groups, and welcome. Existing rows (any order) are left alone; missing
 * types are inserted with order = null.
 */

const COMMON_OFF_MENU_TYPES = [
  'discussions',
  'events',
  'map',
  'members',
  'moderation',
  'projects',
  'proposals',
  'related-groups',
  'requests-and-offers',
  'resources',
  'welcome'
]

exports.up = async function up (knex) {
  const now = new Date()
  const groupIds = await knex('groups').pluck('id')

  for (const groupId of groupIds) {
    const existing = await knex('group_views')
      .where({ group_id: groupId })
      .whereIn('type', COMMON_OFF_MENU_TYPES)
      .pluck('type')
    const existingTypes = new Set(existing)

    for (const type of COMMON_OFF_MENU_TYPES) {
      if (existingTypes.has(type)) continue
      await knex('group_views').insert({
        group_id: groupId,
        type,
        order: null,
        created_at: now,
        updated_at: now
      })
    }
  }
}

exports.down = async function down (knex) {
  // Leave rows in place — removing them would drop steward customizations / soft-removes.
}
