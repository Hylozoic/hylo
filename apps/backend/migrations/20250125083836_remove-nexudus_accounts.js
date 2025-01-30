exports.up = function(knex) {
  console.log("Remove nexudus accounts")
  return knex.schema.dropTable('nexudus_accounts')
}

exports.down = function(knex) {
  return knex.schema.createTable('nexudus_accounts', table => {
    table.increments().primary()
    table.bigInteger('community_id')
    table.bigInteger('other_user_id').references('id').inTable('users')
    table.string('space_id')
    table.string('username')
    table.string('password')
    table.boolean('autoupdate')
  })
}
