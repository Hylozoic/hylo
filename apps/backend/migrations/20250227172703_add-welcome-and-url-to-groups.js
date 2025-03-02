
exports.up = async function (knex) {
  await knex.schema.table('groups', table => {
    table.text('welcome_page')
    table.text('website_url')
  })
}

exports.down = async function (knex) {
  await knex.schema.table('groups', table => {
    table.dropColumn('welcome_page')
    table.dropColumn('website_url')
  })

  await knex('context_widgets')
    .where('title', 'widget-welcome')
    .delete()
}
