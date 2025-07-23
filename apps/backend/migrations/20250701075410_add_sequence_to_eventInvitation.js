exports.up = function (knex) {
  return knex.schema.table('event_invitations', function (table) {
    table.integer('ical_sequence')
  })
}

exports.down = function (knex) {
  return knex.schema.table('event_invitations', function (table) {
    table.dropColumn('ical_sequence')
  })
}
