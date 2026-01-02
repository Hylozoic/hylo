exports.up = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.boolean('hide_final_results_from_participants').defaultTo(false)
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.dropColumn('hide_final_results_from_participants')
  })
}

