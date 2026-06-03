exports.up = async function (knex) {
  await knex.schema.alterTable('drafts', table => {
    table.string('post_type', 20).nullable()
  })

  await knex.raw(`
    UPDATE drafts
    SET post_type = COALESCE(data->>'type', 'discussion')
    WHERE type = 'post' AND is_edit = false
  `)

  await knex.raw('DROP INDEX IF EXISTS drafts_new_post_unique')

  await knex.raw(`
    CREATE UNIQUE INDEX drafts_new_post_unique
    ON drafts (user_id, group_id, COALESCE(topic_id, -1), COALESCE(post_type, 'discussion'))
    WHERE type = 'post' AND is_edit = false AND post_id IS NULL
  `)
}

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS drafts_new_post_unique')

  await knex.raw(`
    CREATE UNIQUE INDEX drafts_new_post_unique
    ON drafts (user_id, group_id, COALESCE(topic_id, -1))
    WHERE type = 'post' AND is_edit = false AND post_id IS NULL
  `)

  await knex.schema.alterTable('drafts', table => {
    table.dropColumn('post_type')
  })
}
