exports.up = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.boolean('show_realtime_votes').defaultTo(false)
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.dropColumn('show_realtime_votes')
  })
}
