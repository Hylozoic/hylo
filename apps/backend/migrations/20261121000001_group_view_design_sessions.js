/**
 * Designed views (#1784, decision Q-27): the "Design your own view" chat with Axl, and the page
 * not saved yet, are kept on the server so they survive a reload and can be picked up on another
 * device.
 *
 * One row per designed view, shared by every steward of the group (decision V-05): any of them can
 * read the conversation and carry it on. `view_id` is null for the page that has not been added to
 * the menu yet (the designer's "new" page), so a group has at most one of those, also shared.
 * `messages` is the conversation, [{ role: 'user' | 'assistant', text, userId }] (userId on the
 * stewards' messages, so the chat shows who asked), and stays after the page is saved. `draft` is
 * the unsaved page (design, name, attached images, PDFs and posts, Axl's suggestions, running
 * cost), or null when nothing differs from what is saved.
 *
 * `version` goes up by one with every change. A steward's browser sends the version it last saw,
 * and a change made against an older one is refused, so two stewards never overwrite each other.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('group_view_design_sessions', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.bigInteger('view_id').nullable().references('id').inTable('group_views').onDelete('CASCADE')
      .comment('The designed view, or null for a page not added to the menu yet')
    table.jsonb('messages').notNullable().defaultTo('[]')
      .comment("The chat with Axl: [{ role: 'user' | 'assistant', text, userId }]")
    table.jsonb('draft').nullable()
      .comment('The unsaved page, or null when it matches the saved view')
    table.integer('version').notNullable().defaultTo(1)
      .comment('Goes up with every change; a change made against an older version is refused')
    table.bigInteger('updated_by_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      .comment('The steward who changed it last')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw(`
    CREATE UNIQUE INDEX group_view_design_sessions_unique
    ON group_view_design_sessions (group_id, COALESCE(view_id, 0))
  `)
  await knex.raw('CREATE INDEX group_view_design_sessions_view_id_index ON group_view_design_sessions (view_id)')
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('group_view_design_sessions')
}
