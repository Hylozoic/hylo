exports.up = async function (knex) {
  await knex.schema.createTable('drafts', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('user_id').references('id').inTable('users').notNullable().index()
    table.string('type', 20).notNullable() // 'post' | 'comment' | 'message'
    table.jsonb('data').notNullable().defaultTo('{}')
    table.bigInteger('post_id').references('id').inTable('posts').nullable()
    table.bigInteger('group_id').references('id').inTable('groups').nullable()
    table.bigInteger('topic_id').references('id').inTable('tags').nullable()
    // message_thread_id references posts table since MessageThreads are Posts with type 'message'
    table.bigInteger('message_thread_id').references('id').inTable('posts').nullable()
    table.boolean('is_edit').defaultTo(false)
    table.text('navigate_to').nullable()
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  // One new-post draft per user per group+topic context
  await knex.raw(`
    CREATE UNIQUE INDEX drafts_new_post_unique
    ON drafts (user_id, group_id, COALESCE(topic_id, -1))
    WHERE type = 'post' AND is_edit = false AND post_id IS NULL
  `)

  // One edit-post draft per user per post
  await knex.raw(`
    CREATE UNIQUE INDEX drafts_edit_post_unique
    ON drafts (user_id, post_id)
    WHERE type = 'post' AND is_edit = true
  `)

  // One comment draft per user per post
  await knex.raw(`
    CREATE UNIQUE INDEX drafts_comment_unique
    ON drafts (user_id, post_id)
    WHERE type = 'comment'
  `)

  // One message draft per user per thread
  await knex.raw(`
    CREATE UNIQUE INDEX drafts_message_unique
    ON drafts (user_id, message_thread_id)
    WHERE type = 'message'
  `)
}

exports.down = async function (knex) {
  await knex.schema.dropTable('drafts')
}
