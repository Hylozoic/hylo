exports.up = async function (knex) {
  await knex.schema.alterTable('posts', table => {
    table.integer('ical_sequence')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('posts', table => {
    table.dropColumn('ical_sequence')
  })
}
