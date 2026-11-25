/**
 * Group Assistant (Axl): the steward thread.
 *
 * One thread per group, shared by its stewards and the assistant. Each row is
 * one message: from a steward (author_type 'steward', user_id set) or from the
 * assistant (author_type 'axl', user_id null). `parts` holds the structured
 * parts of an assistant message (counsel, bullets, quoted posts, drafts), as
 * checked by sanitizeAssistantParts in @hylo/shared.
 *
 * The assistant's settings live in groups.settings.assistant, so they need no table.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('group_assistant_messages', function (table) {
    table.bigIncrements('id').primary()
    table.bigInteger('group_id').unsigned().notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.string('author_type', 16).notNullable().comment("'steward' or 'axl'")
    table.bigInteger('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
    table.text('text').notNullable().defaultTo('')
    table.jsonb('parts').notNullable().defaultTo('[]')
    table.integer('posts_read').notNullable().defaultTo(0).comment('How many posts and comments the model was shown to write this message')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())

    table.index(['group_id', 'created_at'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTable('group_assistant_messages')
}
