exports.up = async function (knex) {
  await knex.schema.alterTable('users', table => {
    table.string('calendar_token')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('users', table => {
    table.dropColumn('calendar_token')
  })
}
