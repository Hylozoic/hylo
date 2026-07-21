exports.up = async function (knex) {
  await knex.raw(`
    create index if not exists idx_search_index_post_id
      on search_index (post_id)
      where post_id is not null
  `)
  await knex.raw(`
    create index if not exists idx_search_index_user_id
      on search_index (user_id)
      where user_id is not null
  `)
  await knex.raw(`
    create index if not exists idx_search_index_comment_id
      on search_index (comment_id)
      where comment_id is not null
  `)
}

exports.down = async function (knex) {
  await knex.raw('drop index if exists idx_search_index_post_id')
  await knex.raw('drop index if exists idx_search_index_user_id')
  await knex.raw('drop index if exists idx_search_index_comment_id')
}
