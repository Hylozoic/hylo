// Indexes for the hot read path. Created concurrently so a deploy does not
// lock posts, groups_posts, posts_users, notifications, or activities.
// Concurrent index builds cannot run inside a transaction.
exports.config = { transaction: false }

const INDEXES = [
  // postFilter joins groups_posts on post_id. The unique key leads with group_id.
  'create index concurrently if not exists groups_posts_post_id_group_id_index on groups_posts (post_id, group_id)',
  // followed posts and unread threads filter posts_users by user_id. The unique key leads with post_id.
  'create index concurrently if not exists posts_users_user_id_following_active_index on posts_users (user_id, post_id) where following = true and active = true',
  // in-app notification list: user_id + medium, newest id first
  'create index concurrently if not exists notifications_user_id_medium_id_index on notifications (user_id, medium, id desc)',
  // unread counts and per-reader activity lookups
  'create index concurrently if not exists activities_reader_id_unread_index on activities (reader_id, unread)',
  // default stream filter is active posts ordered by updated_at
  'create index concurrently if not exists posts_active_updated_at_index on posts (updated_at desc) where active = true',
  // topic counts and tag filters. The unique key leads with post_id.
  'create index concurrently if not exists posts_tags_tag_id_post_id_index on posts_tags (tag_id, post_id)'
]

const INDEX_NAMES = [
  'groups_posts_post_id_group_id_index',
  'posts_users_user_id_following_active_index',
  'notifications_user_id_medium_id_index',
  'activities_reader_id_unread_index',
  'posts_active_updated_at_index',
  'posts_tags_tag_id_post_id_index'
]

exports.up = async function (knex) {
  for (const sql of INDEXES) {
    await knex.raw(sql)
  }
}

exports.down = async function (knex) {
  for (const name of INDEX_NAMES) {
    await knex.raw(`drop index concurrently if exists ${name}`)
  }
}
