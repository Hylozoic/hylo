/**
 * Setting a post or member view as home stored /post or /members because
 * the route was computed without post_id / user_id. Rewrite those home
 * routes from the order-0 view.
 */

exports.up = async function (knex) {
  await knex.raw(`
    UPDATE groups
    SET home_route = '/post/' || group_views.post_id::text
    FROM group_views
    WHERE group_views.group_id = groups.id
      AND group_views."order" = 0
      AND group_views.type = 'post'
      AND group_views.post_id IS NOT NULL
      AND groups.home_route IS DISTINCT FROM ('/post/' || group_views.post_id::text)
  `)

  await knex.raw(`
    UPDATE groups
    SET home_route = '/members/' || group_views.user_id::text
    FROM group_views
    WHERE group_views.group_id = groups.id
      AND group_views."order" = 0
      AND group_views.type = 'member'
      AND group_views.user_id IS NOT NULL
      AND groups.home_route IS DISTINCT FROM ('/members/' || group_views.user_id::text)
  `)
}

exports.down = async function () {}
