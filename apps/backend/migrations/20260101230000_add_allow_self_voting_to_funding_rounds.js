exports.up = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.boolean('allow_self_voting').defaultTo(false)
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.dropColumn('allow_self_voting')
  })
}

