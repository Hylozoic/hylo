exports.up = function (knex, Promise) {
  return knex.schema.createTable('user_profile_links', t => {
    t.increments().primary()
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.string('url').notNullable()
    t.string('title')
    t.string('icon_url')
    t.integer('sort_order').notNullable().defaultTo(0)
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    t.index(['user_id', 'sort_order'])
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTable('user_profile_links')
}
