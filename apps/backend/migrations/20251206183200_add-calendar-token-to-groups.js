exports.up = async function (knex) {
  await knex.schema.alterTable('groups', table => {
    table.string('calendar_token')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('groups', table => {
    table.dropColumn('calendar_token')
  })
}
