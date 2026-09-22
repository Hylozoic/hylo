/**
 * About and Related Groups are tabs on the About page, not GroupView types.
 * Deletes leftover `about` / `related-groups` rows (recreated after
 * 20260817140000 via track copy / setupSpaceViews), compact remaining menu
 * order, remaps home_route, and blocks those types at the DB.
 *
 * group_views_users.view_id and collections_posts.view_id cascade on delete.
 */

const REMOVED_TYPES = ['about', 'related-groups']

/** Route suffix stored on groups.home_route for the order-0 view. */
function homeRouteForView (type, id) {
  if (type === 'custom') return `/custom/${id}`
  if (type === 'collection') return `/collection/${id}`
  if (type === 'space-collection') return `/space-collection/${id}`
  if (type === 'stream') return '/all'
  if (!type) return '/all'
  return `/${type}`
}

/** Re-number remaining ordered views 0..n-1 after deleting removed types. */
async function compactMenuOrder (knex, groupId) {
  const remaining = await knex('group_views')
    .where({ group_id: groupId })
    .whereNotNull('order')
    .orderBy('order', 'asc')
    .select('id', 'order')

  for (let i = 0; i < remaining.length; i++) {
    if (Number(remaining[i].order) !== i) {
      await knex('group_views').where({ id: remaining[i].id }).update({ order: i })
    }
  }
}

exports.up = async function up (knex) {
  const affectedGroupIds = await knex('group_views')
    .whereIn('type', REMOVED_TYPES)
    .distinct('group_id')
    .pluck('group_id')

  await knex('group_views').whereIn('type', REMOVED_TYPES).delete()

  for (const groupId of affectedGroupIds) {
    await compactMenuOrder(knex, groupId)
  }

  const leftoverHomeGroupIds = await knex('groups')
    .whereIn('home_route', ['/about', '/related-groups'])
    .pluck('id')
  const homeGroupIds = [...new Set([...affectedGroupIds, ...leftoverHomeGroupIds])]

  for (const groupId of homeGroupIds) {
    const home = await knex('group_views')
      .where({ group_id: groupId, order: 0 })
      .first('id', 'type')
    const homeRoute = home ? homeRouteForView(home.type, home.id) : '/all'
    await knex('groups').where({ id: groupId }).update({ home_route: homeRoute })
  }
}

exports.down = async function down (knex) {
}
