/**
 * Designed views (#1784, decision Q-27): the "Design your own view" chat with Axl, and the page a
 * steward has not saved yet, are kept on the server so they survive a reload and can be picked up
 * on another device.
 *
 * One row per steward per designed view. `view_id` is null for a page that has not been added to
 * the menu yet (the designer's "new" page), so each steward has at most one of those per group.
 * `messages` is the conversation, [{ role: 'user' | 'assistant', text }], and stays after the page
 * is saved. `draft` is the unsaved page (design, name, attached images, PDFs and posts, Axl's
 * suggestions, running cost), or null when nothing differs from what is saved.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('group_view_design_sessions', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.bigInteger('view_id').nullable().references('id').inTable('group_views').onDelete('CASCADE')
      .comment('The designed view, or null for a page not added to the menu yet')
    table.jsonb('messages').notNullable().defaultTo('[]')
      .comment("The chat with Axl: [{ role: 'user' | 'assistant', text }]")
    table.jsonb('draft').nullable()
      .comment('The unsaved page, or null when it matches the saved view')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw(`
    CREATE UNIQUE INDEX group_view_design_sessions_unique
    ON group_view_design_sessions (group_id, user_id, COALESCE(view_id, 0))
  `)
  await knex.raw('CREATE INDEX group_view_design_sessions_view_id_index ON group_view_design_sessions (view_id)')
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('group_view_design_sessions')
}
