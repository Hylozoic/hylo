exports.up = function(knex) {
  return knex.schema.dropTable('nexudus_accounts')
}

exports.down = function(knex) {
  return knex.schema.createTable('user_connections', table => {
    table.increments().primary()
    table.bigInteger('community_id')
    table.bigInteger('other_user_id').references('id').inTable('users')
    table.string('space_id')
    table.string('username')
    table.string('password')
    table.boolean('autoupdate')
  })
}
