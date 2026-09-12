exports.up = async function (knex) {
  await knex.schema.alterTable('site_banners', table => {
    table.boolean('show_to_new_users').notNullable().defaultTo(false)
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('site_banners', table => {
    table.dropColumn('show_to_new_users')
  })
}
