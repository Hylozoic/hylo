
exports.up = function (knex) {
  return knex.schema.table('posts', table => {
    table.string('meeting_link')
  })
}

exports.down = function (knex) {
  return knex.schema.table('posts', table => {
    table.dropColumn('meeting_link')
  })
}
