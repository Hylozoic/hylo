/**
 * Ensure every group with group_views has related-groups, moderation, and welcome
 * rows (order = null) for More Views and Spaces.
 */

exports.up = async function up (knex) {
  const now = new Date()
  const groupIds = await knex('group_views').distinct('group_id').pluck('group_id')
  const types = ['related-groups', 'moderation', 'welcome']

  for (const groupId of groupIds) {
    const existing = await knex('group_views')
      .where({ group_id: groupId })
      .whereIn('type', types)
      .pluck('type')
    const existingTypes = new Set(existing)

    for (const type of types) {
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
  // Leave rows in place — removing them would drop steward customizations.
}
