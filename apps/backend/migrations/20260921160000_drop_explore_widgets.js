/**
 * Drop the explore-page widget catalog. Farm profiles render a hardcoded widget
 * list and no longer read these tables.
 *
 * down() recreates the tables and the 21-row widget catalog. Per-group
 * group_widgets rows are not recoverable.
 */

const WIDGET_CATALOG = [
  [1, 'text_block'],
  [2, 'announcements'],
  [3, 'active_members'],
  [4, 'requests_offers'],
  [5, 'posts'],
  [6, 'community_topics'],
  [7, 'events'],
  [8, 'project_activity'],
  [9, 'group_affiliations'],
  [10, 'map'],
  [11, 'nearby_relevant_groups'],
  [12, 'nearby_relevant_events'],
  [13, 'nearby_relevant_requests_offers'],
  [14, 'farm_comparison'],
  [15, 'opportunities_to_collaborate'],
  [16, 'farm_map'],
  [17, 'moderators'],
  [18, 'privacy_settings'],
  [19, 'mission'],
  [20, 'topics'],
  [21, 'join']
]

exports.up = async function (knex) {
  await knex('groups').where({ home_route: '/explore' }).update({ home_route: '/all' })
  await knex.schema.dropTableIfExists('group_widgets')
  await knex.schema.dropTableIfExists('widgets')
}

exports.down = async function (knex) {
  await knex.schema.createTable('widgets', table => {
    table.increments().primary()
    table.string('name')
    table.timestamp('created_at')
  })

  const now = new Date().toISOString()
  await knex('widgets').insert(WIDGET_CATALOG.map(([id, name]) => ({
    id,
    name,
    created_at: now
  })))
  await knex.raw("SELECT setval(pg_get_serial_sequence('widgets', 'id'), (SELECT MAX(id) FROM widgets))")

  await knex.schema.createTable('group_widgets', table => {
    table.increments().primary()
    table.bigInteger('group_id').references('id').inTable('groups').index().notNullable()
    table.bigInteger('widget_id').references('id').inTable('widgets').notNullable()
    table.jsonb('settings').defaultTo('{}')
    table.boolean('is_visible').defaultTo(true)
    table.integer('order')
    table.string('context')
    table.timestamp('created_at')
  })
}
