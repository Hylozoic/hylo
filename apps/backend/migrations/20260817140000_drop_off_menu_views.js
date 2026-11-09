/**
 * Views are now binary: in the menu or deleted. Off-menu (order = null) is
 * reserved for space rows that live in More Spaces.
 *
 * Deletes:
 * - every group_views row with order IS NULL except type = 'space'
 * - leftover about / moderation / related-groups rows (those become About tabs)
 *
 * group_views_users.view_id and collections_posts.view_id cascade on delete.
 */

exports.up = async function up (knex) {
  await knex('group_views').whereNull('order').whereNot('type', 'space').delete()
  await knex('group_views').whereIn('type', ['about', 'moderation', 'related-groups']).delete()
}

exports.down = async function down (knex) {
  // Irreversible — off-menu views and chrome types were deleted by design.
}
