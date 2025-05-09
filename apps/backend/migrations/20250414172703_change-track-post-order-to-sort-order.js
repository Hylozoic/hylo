
exports.up = async function (knex) {
  await knex.schema.alterTable('tracks_posts', table => {
    table.renameColumn('order', 'sort_order')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('tracks_posts', table => {
    table.renameColumn('sort_order', 'order')
  })
}
