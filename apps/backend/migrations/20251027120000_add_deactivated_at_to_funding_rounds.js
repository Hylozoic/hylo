exports.up = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.timestamp('deactivated_at')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.dropColumn('deactivated_at')
  })
}
