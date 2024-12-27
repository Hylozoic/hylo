exports.up = function(knex) {
  return knex.schema
    .createTable('context_widgets', table => {
      table.bigIncrements('id').primary()
      table.string('title')
      table.bigInteger('group_id').references('id').inTable('groups').onDelete('CASCADE') // ownership
      table.string('type')
      table.integer('order') // if null, widget won't be shown in the menu but will still be in the 'all views'
      table.string('visibility')
      table.bigInteger('parent_id').references('id').inTable('context_widgets').onDelete('CASCADE')
      table.string('view')
      table.string('icon') 
      table.boolean('auto_added').defaultTo(false)
      table.bigInteger('view_group_id').references('id').inTable('groups').onDelete('CASCADE') // view group
      table.bigInteger('view_post_id').references('id').inTable('posts').onDelete('CASCADE') // view post
      table.bigInteger('custom_view_id').references('id').inTable('custom_views').onDelete('CASCADE') // custom view
      table.bigInteger('view_user_id').references('id').inTable('users').onDelete('CASCADE') // view user
      table.bigInteger('view_chat_id').references('id').inTable('tags').onDelete('CASCADE') // view user
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.index('group_id')
      table.index('parent_id')
    })
    .then(() => knex.raw('ALTER TABLE context_widgets ALTER CONSTRAINT context_widgets_group_id_foreign DEFERRABLE INITIALLY DEFERRED'))
    .then(() => knex.raw('ALTER TABLE context_widgets ALTER CONSTRAINT context_widgets_parent_id_foreign DEFERRABLE INITIALLY DEFERRED'))
    .then(() => knex.raw(`
      ALTER TABLE context_widgets 
      ADD CONSTRAINT single_view_reference
      CHECK (
        (CASE WHEN view_group_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN view_post_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN view IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN custom_view_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN view_user_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN view_chat_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
      )
    `)) // only one view reference can be set
}


exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('context_widgets')
}