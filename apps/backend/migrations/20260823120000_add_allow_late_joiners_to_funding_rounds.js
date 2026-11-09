exports.up = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.boolean('allow_late_joiners').defaultTo(false)
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.dropColumn('allow_late_joiners')
  })
}
