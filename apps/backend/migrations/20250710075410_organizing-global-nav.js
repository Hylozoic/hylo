exports.up = async function (knex) {
  // Add order column to group memberships for global nav drawer
  await knex.schema.alterTable('group_memberships', table => {
    table.integer('nav_order').defaultTo(null)
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('group_memberships', table => {
    table.dropColumn('nav_order')
  })
}
