exports.up = async function (knex) {
  await knex.schema.createTable('site_banners', table => {
    table.increments('id').primary()
    table.text('text')
    table.text('type').defaultTo('info')
    table.text('action_text')
    table.text('action_url')
    table.bigInteger('created_by_id').references('id').inTable('users')
    table.timestamp('published_at')
    table.timestamp('unpublished_at')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('site_banners_users', table => {
    table.increments('id').primary()
    table.integer('site_banner_id').references('id').inTable('site_banners').onDelete('CASCADE')
    table.bigInteger('user_id').references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('dismissed_at').defaultTo(knex.fn.now())
    table.unique(['site_banner_id', 'user_id'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTable('site_banners_users')
  await knex.schema.dropTable('site_banners')
}
