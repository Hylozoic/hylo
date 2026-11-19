// Tasks: a post type with a kanban status.
// - task_statuses: the columns of a group's (or space's) Tasks board. Each column has a
//   category (todo / active / done) so "complete" keeps its meaning when a column is renamed.
// - groups_posts.task_status_id / task_position: where a task sits on each group's board.
//   A task posted to several groups has one placement per group.
// - posts.task_category: the category shared by every board the task is on.
// - task_events: a log of what happened to a task, used for the daily summary and notifications.
exports.up = async function (knex) {
  await knex.schema.createTable('task_statuses', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.string('name').notNullable()
    table.string('category').notNullable().defaultTo('active')
    table.integer('order').notNullable().defaultTo(0)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['group_id', 'order'])
  })

  await knex.schema.alterTable('groups_posts', table => {
    table.bigInteger('task_status_id').references('id').inTable('task_statuses').onDelete('SET NULL')
    table.double('task_position')
    table.index(['task_status_id', 'task_position'])
  })

  await knex.schema.alterTable('posts', table => {
    table.string('task_category')
  })

  await knex.schema.createTable('task_events', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE')
    table.bigInteger('group_id').references('id').inTable('groups').onDelete('CASCADE')
    table.bigInteger('actor_id').references('id').inTable('users').onDelete('SET NULL')
    table.string('type').notNullable()
    table.jsonb('meta').notNullable().defaultTo('{}')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['group_id', 'created_at'])
    table.index(['post_id', 'created_at'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTable('task_events')
  await knex.schema.alterTable('posts', table => {
    table.dropColumn('task_category')
  })
  await knex.schema.alterTable('groups_posts', table => {
    table.dropIndex(['task_status_id', 'task_position'])
    table.dropColumn('task_status_id')
    table.dropColumn('task_position')
  })
  await knex.schema.dropTable('task_statuses')
}
