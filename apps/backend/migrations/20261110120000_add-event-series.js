exports.up = async function (knex) {
  await knex.schema.createTable('event_series', table => {
    table.bigIncrements().primary()
    table.bigInteger('user_id').references('id').inTable('users')
    table.text('recurrence_rule').notNullable()
    table.string('timezone')
    // The series anchor (DTSTART): the start of the first occurrence
    table.timestamp('start_time')
    table.boolean('is_active').defaultTo(true)
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })
  await knex.raw('alter table event_series alter constraint event_series_user_id_foreign deferrable initially deferred')

  await knex.schema.alterTable('posts', table => {
    table.bigInteger('event_series_id').references('id').inTable('event_series')
    // The slot this occurrence was generated for; diverging start_time means it was individually rescheduled
    table.timestamp('original_start_time')
    table.index('event_series_id')
  })
  await knex.raw('alter table posts alter constraint posts_event_series_id_foreign deferrable initially deferred')
}

exports.down = async function (knex) {
  await knex.schema.alterTable('posts', table => {
    table.dropIndex('event_series_id')
    table.dropColumn('event_series_id')
    table.dropColumn('original_start_time')
  })
  await knex.schema.dropTable('event_series')
}
