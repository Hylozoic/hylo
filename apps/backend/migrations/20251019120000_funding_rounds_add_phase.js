exports.up = async function (knex) {
  await knex.schema.table('funding_rounds', table => {
    table.string('phase').defaultTo('draft')
    table.dropColumn('tokens_distributed_at')
  })
}

exports.down = async function (knex) {
  await knex.schema.table('funding_rounds', table => {
    table.dropColumn('phase')
    table.timestamp('tokens_distributed_at')
  })
}
